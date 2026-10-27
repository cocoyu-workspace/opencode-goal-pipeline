package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func isHubSubclient(args []string) bool {
	for i := 0; i < len(args); i++ {
		if args[i] == "--subclient_type" && i+1 < len(args) && args[i+1] == "hub" {
			return true
		}
		if args[i] == "--subclient_type=hub" {
			return true
		}
	}
	return false
}

func hasWebBundleFlag(args []string) bool {
	for _, a := range args {
		if a == "--web_bundle_path" || strings.HasPrefix(a, "--web_bundle_path=") {
			return true
		}
	}
	return false
}

func main() {
	exe, err := os.Executable()
	if err != nil {
		exe = os.Args[0]
	}
	realBin := filepath.Join(filepath.Dir(exe), "language_server.real")
	args := append([]string{os.Args[0]}, os.Args[1:]...)

	if isHubSubclient(os.Args[1:]) {
		home, _ := os.UserHomeDir()
		if home != "" && !hasWebBundleFlag(os.Args[1:]) {
			bundlePath := filepath.Join(home, ".gemini", "antigravity", "web_bundle_custom.zip")
			if st, err := os.Stat(bundlePath); err == nil && st.Size() > 0 {
				args = append(args, "--web_bundle_path="+bundlePath)
			}
		}
		if os.Getenv("GEMINI_API_KEY") == "" {
			_ = os.Setenv("GEMINI_API_KEY", "magpie-agy")
		}
		if os.Getenv("GOOGLE_GEMINI_BASE_URL") == "" {
			_ = os.Setenv("GOOGLE_GEMINI_BASE_URL", "http://127.0.0.1:3425")
		}
		syncScript := "/Users/mac/dev/opencode-goal-pipeline/agy-magpie-harness/bin/sync-agy-gui-models.py"
		if _, err := os.Stat(syncScript); err == nil {
			cmd := exec.Command("python3", syncScript, "--wait", "--quiet")
			_ = cmd.Start()
		}
	}

	if err := syscall.Exec(realBin, args, os.Environ()); err != nil {
		os.Exit(1)
	}
}
