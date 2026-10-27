import argparse
import http.server
import json
import os
from pathlib import Path
import subprocess
import signal
import tempfile
import threading
import time

parser = argparse.ArgumentParser(description='Run isolated OpenCode CLI fault injection against a local mock provider.')
parser.add_argument('--plugin', required=True, type=Path)
parser.add_argument('--case', choices=['401', '429', '503', '400', 'success', 'exhaust', 'header-timeout', 'chunk-timeout', 'cancel', 'cross-provider'], required=True)
args = parser.parse_args()
args.plugin = args.plugin.resolve()
requests = []
request_started = threading.Event()
class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))))
        model = body.get('model')
        requests.append(model)
        request_started.set()
        primary = model == 'word/claude-opus-5-5'
        if args.case in ['header-timeout', 'chunk-timeout', 'cancel'] and primary:
            if args.case == 'chunk-timeout':
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.end_headers()
                self.wfile.flush()
            self.connection.settimeout(8)
            try:
                self.rfile.read(1)
            except OSError:
                pass
            return
        status = 200
        if args.case == 'exhaust' or args.case == 'cross-provider' and model in ['word/claude-opus-5-5','word/claude-sonnet-5-5']:
            status = 401
        elif primary and args.case in ['401', '429', '503', '400']:
            status = int(args.case)
        if status != 200:
            data = json.dumps({'type': 'error', 'error': {'type': {401:'authentication_error',429:'rate_limit_error',503:'api_error',400:'invalid_request_error'}[status], 'message': 'LOCAL_FAULT_PROBE'}}).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
        else:
            message = {'id':'msg_probe','type':'message','role':'assistant','model':model,'content':[],'stop_reason':None,'stop_sequence':None,'usage':{'input_tokens':1,'output_tokens':0}}
            events = [{'type':'message_start','message':message},{'type':'content_block_start','index':0,'content_block':{'type':'text','text':''}},{'type':'content_block_delta','index':0,'delta':{'type':'text_delta','text':'LOCAL_RECOVERY_OK'}},{'type':'content_block_stop','index':0},{'type':'message_delta','delta':{'stop_reason':'end_turn','stop_sequence':None},'usage':{'output_tokens':3}},{'type':'message_stop'}]
            data = ''.join('event: '+e['type']+'\ndata: '+json.dumps(e)+'\n\n' for e in events).encode()
            self.send_response(200)
            self.send_header('Content-Type','text/event-stream')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass
    def log_message(self, *args):
        pass
server = http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
with tempfile.TemporaryDirectory(prefix='fallback-acceptance-') as temp:
    root=Path(temp)
    package=root/'plugin'
    package.mkdir()
    (package/'package.json').write_text(json.dumps({'name':'fallback-acceptance','type':'module','main':'index.mjs'}))
    (package/'index.mjs').write_text(args.plugin.read_text())
    settings={'baseURL':f'http://127.0.0.1:{server.server_port}/v1','apiKey':'local-test-key','timeout':1500,'headerTimeout':500,'chunkTimeout':500}
    models={'claude-opus-5-5':'word/claude-opus-5-5','claude-sonnet-5-5':'word/claude-sonnet-5-5'}
    providers={}
    for provider, ids in [('word-claude',models),('perplexity',{'sonnet-5.5':'perplexity/sonnet-5.5'}),('openai',{'gpt-6.1-sol':'gpt-6.1-sol'})]:
        providers[provider]={'package':'@opencode/ai/providers/anthropic-compatible','settings':settings,'models':{k:{'modelID':v,'capabilities':{'tools':True,'input':['text'],'output':['text'],'reasoning':{'supported':True,'effort':['medium','high']}},'limit':{'context':100000,'input':80000,'output':4000}} for k,v in ids.items()}}
    config={'plugins':[str(package)],'providers':providers,'agents':{'coder':{'mode':'subagent','model':'word-claude/claude-opus-5-5#medium'}},'mcp':{'servers':{}}}
    env=os.environ.copy()
    env['OPENCODE_CONFIG_DIR']=str(root/'config')
    env['OPENCODE_CONFIG_CONTENT']=json.dumps(config)
    start=time.monotonic()
    try:
        command=['opencode','run','--standalone','--agent','coder','-m','word-claude/claude-opus-5-5#medium','--format','json','Only reply LOCAL_RECOVERY_OK. Do not call tools.']
        if args.case == 'cancel':
            process=subprocess.Popen(command,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            try:
                assert request_started.wait(10), 'CLI never reached local server'
                process.send_signal(signal.SIGINT)
                stdout,stderr=process.communicate(timeout=10)
                result=subprocess.CompletedProcess(command,process.returncode,stdout,stderr)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.communicate()
        else:
            result=subprocess.run(command,cwd=root,env=env,capture_output=True,text=True,timeout=35)
        output=result.stdout+result.stderr
        code=result.returncode
    except subprocess.TimeoutExpired as error:
        output=str(error.stdout)+str(error.stderr)
        code=124
    summary={'case':args.case,'exit':code,'requests':requests,'elapsed_seconds':round(time.monotonic()-start,2),'has_success':'LOCAL_RECOVERY_OK' in output}
    print(json.dumps(summary))
    print(output[-5000:])
server.shutdown()
expected_failure=args.case in ['400','exhaust','cancel']
assert code != 124, summary
assert (code != 0) if expected_failure else (code == 0 and summary['has_success']), summary
if args.case in ['400','success','cancel']:
    assert all(model=='word/claude-opus-5-5' for model in requests), summary
elif not expected_failure:
    assert any(model!='word/claude-opus-5-5' for model in requests), summary
else:
    assert 'perplexity/sonnet-5.5' in requests and 'gpt-6.1-sol' in requests, summary
