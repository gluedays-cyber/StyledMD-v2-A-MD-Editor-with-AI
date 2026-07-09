package pkg

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2"
)

var (
	TargetFile     string
	BaseDir        string
	Wv             webview2.WebView
	CurrentRootDir string
	RootDirMu      sync.RWMutex
)

func SetCurrentRootDir(path string) {
	RootDirMu.Lock()
	defer RootDirMu.Unlock()
	if CurrentRootDir != "" {
		return // 이미 루트 디렉토리가 설정되어 있다면 변경하지 않는다.
	}
	CurrentRootDir = filepath.Clean(path)
}

func GetCurrentRootDir() string {
	RootDirMu.RLock()
	defer RootDirMu.RUnlock()
	return CurrentRootDir
}

type DocData struct {
	Content  string `json:"content"`
	FileName string `json:"filename"`
	FileDir  string `json:"fileDir"`
}

// SafePathResolver는 요청 경로를 검증하여 안전한 절대 경로를 반환한다.
func SafePathResolver(rootDir, reqPath string) (string, error) {
	if reqPath == "" {
		return "", nil
	}

	cleaned := filepath.Clean(reqPath)

	// 상대 경로인 경우 현재 웹 루트 디렉토리 내부로 제한하며 상위 디렉토리로의 이탈을 감시한다.
	if !filepath.IsAbs(cleaned) {
		finalPath := filepath.Join(rootDir, cleaned)
		rel, err := filepath.Rel(rootDir, finalPath)
		if err != nil || strings.HasPrefix(rel, "..") {
			return "", os.ErrPermission
		}
		return finalPath, nil
	}

	return cleaned, nil
}

func LoadHandler(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		reqPath = TargetFile
	}

	rootDir := GetCurrentRootDir()
	resolvedPath, err := SafePathResolver(rootDir, reqPath)
	if err != nil {
		http.Error(w, "Access Denied: Path escape detected", http.StatusForbidden)
		return
	}

	if resolvedPath == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(DocData{
			Content:  "",
			FileName: "Untitled.md",
			FileDir:  "",
		})
		return
	}

	content, err := os.ReadFile(resolvedPath)
	if err != nil {
		http.Error(w, "파일을 읽을 수 없습니다: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 웹 서버의 고정 루트 디렉토리 기준 상대 경로를 계산한다.
	relPath, err := filepath.Rel(rootDir, resolvedPath)
	if err != nil {
		relPath = filepath.Base(resolvedPath)
	}
	relPath = filepath.ToSlash(relPath)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DocData{
		Content:  string(content),
		FileName: relPath, // 주소창 및 식별 기준이 될 웹 루트 기준 상대 경로
		FileDir:  filepath.Dir(resolvedPath),
	})
}

func SaveHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "잘못된 요청", http.StatusBadRequest)
		return
	}

	rootDir := GetCurrentRootDir()
	resolvedPath, err := SafePathResolver(rootDir, req.Path)
	if err != nil {
		http.Error(w, "Access Denied: Path escape detected", http.StatusForbidden)
		return
	}

	if resolvedPath == "" || resolvedPath == "." || resolvedPath == "/" || resolvedPath == "\\" {
		w.WriteHeader(http.StatusOK)
		return
	}

	dir := filepath.Dir(resolvedPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		http.Error(w, "디렉토리를 생성할 수 없습니다: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(resolvedPath, []byte(req.Content), 0644); err != nil {
		http.Error(w, "파일을 저장할 수 없습니다: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 저장 성공 시 처리
	w.WriteHeader(http.StatusOK)
}

type RECT struct {
	Left, Top, Right, Bottom int32
}

type MONITORINFO struct {
	CbSize    uint32
	RcMonitor RECT
	RcWork    RECT
	DwFlags   uint32
}

var isFirstResize = true

func resizeWindowOnScreen(width, height int) {
	hwnd := Wv.Window()
	if hwnd == nil {
		return
	}

	user32 := syscall.NewLazyDLL("user32.dll")
	getWindowRect := user32.NewProc("GetWindowRect")
	setWindowPos := user32.NewProc("SetWindowPos")
	monitorFromWindow := user32.NewProc("MonitorFromWindow")
	getMonitorInfoW := user32.NewProc("GetMonitorInfoW")

	var rect RECT
	getWindowRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rect)))

	// MONITOR_DEFAULTTONEAREST = 2
	hMonitor, _, _ := monitorFromWindow.Call(uintptr(hwnd), 2)

	var monitorInfo MONITORINFO
	monitorInfo.CbSize = uint32(unsafe.Sizeof(monitorInfo))
	getMonitorInfoW.Call(hMonitor, uintptr(unsafe.Pointer(&monitorInfo)))

	workArea := monitorInfo.RcWork
	newWidth := int32(width)
	newHeight := int32(height)

	newLeft := rect.Left
	newTop := rect.Top

	// 읽기 모드(가로 816)로 전환 시 화면 우측 상단 초기 위치로 정렬하고 최대 폭 제한을 건다.
	if newWidth == 816 {
		Wv.SetSize(816, 9600, webview2.HintMax) // HintMax (최대 크기 제한)
		
		// 전체화면(최대화) 버튼 비활성화 (WS_MAXIMIZEBOX 스타일 비트 제거)
		var GWL_STYLE int32 = -16
		const WS_MAXIMIZEBOX = 0x00010000
		getWindowLong := user32.NewProc("GetWindowLongW")
		setWindowLong := user32.NewProc("SetWindowLongW")
		
		style, _, _ := getWindowLong.Call(uintptr(hwnd), uintptr(GWL_STYLE))
		if style != 0 {
			newStyle := style &^ WS_MAXIMIZEBOX
			setWindowLong.Call(uintptr(hwnd), uintptr(GWL_STYLE), newStyle)
		}

		newLeft = workArea.Right - newWidth + 7
		newTop = workArea.Top
	} else {
		// 편집 모드 등으로 전환 시 최대 너비 제한 해제 및 최대화 박스 활성화
		Wv.SetSize(int(workArea.Right-workArea.Left), int(workArea.Bottom-workArea.Top), webview2.HintMax)
		
		var GWL_STYLE int32 = -16
		const WS_MAXIMIZEBOX = 0x00010000
		getWindowLong := user32.NewProc("GetWindowLongW")
		setWindowLong := user32.NewProc("SetWindowLongW")
		
		style, _, _ := getWindowLong.Call(uintptr(hwnd), uintptr(GWL_STYLE))
		if style != 0 {
			newStyle := style | WS_MAXIMIZEBOX
			setWindowLong.Call(uintptr(hwnd), uintptr(GWL_STYLE), newStyle)
		}

		// 원래 창의 너비를 계산
		oldWidth := rect.Right - rect.Left
		// 편집모드로 들어갈 때 (816 -> 1616) 창이 좌측으로 커지도록 Left 조정
		if newWidth > oldWidth {
			newLeft = rect.Left - (newWidth - oldWidth)
		} else if newWidth < oldWidth {
			// 편집모드 -> 읽기모드로 전환할 때는 우측(뷰어)이 유지되도록 좌측을 당김
			newLeft = rect.Left + (oldWidth - newWidth)
		}

		if newLeft < workArea.Left {
			newLeft = workArea.Left
		}

		// 하단 화면 경계를 벗어날 경우 상단으로 이동
		if newTop+newHeight > workArea.Bottom {
			newTop = workArea.Bottom - newHeight
		}
		if newTop < workArea.Top {
			newTop = workArea.Top
		}
	}

	if isFirstResize {
		newLeft = workArea.Left + ((workArea.Right - workArea.Left - newWidth) / 2)
		newTop = workArea.Top + ((workArea.Bottom - workArea.Top - newHeight) / 2)
		isFirstResize = false
	}

	// 창 표출 전에 WS_EX_LAYERED 스타일(투명도) 제거하여 정상 상태로 복구
	getWindowLong := user32.NewProc("GetWindowLongW")
	setWindowLong := user32.NewProc("SetWindowLongW")
	var GWL_EXSTYLE int32 = -20
	const WS_EX_LAYERED = 0x00080000
	exStyle, _, _ := getWindowLong.Call(uintptr(hwnd), uintptr(GWL_EXSTYLE))
	if (exStyle & WS_EX_LAYERED) != 0 {
		setWindowLong.Call(uintptr(hwnd), uintptr(GWL_EXSTYLE), exStyle&^WS_EX_LAYERED)
	}

	// SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010, SWP_SHOWWINDOW = 0x0040
	// 추가로 SWP_FRAMECHANGED = 0x0020 (스타일 변경 적용)
	setWindowPos.Call(
		uintptr(hwnd),
		0,
		uintptr(newLeft),
		uintptr(newTop),
		uintptr(newWidth),
		uintptr(newHeight),
		0x0004|0x0010|0x0040|0x0020,
	)
}

func ResizeHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "잘못된 요청", http.StatusBadRequest)
		return
	}

	if Wv != nil {
		Wv.Dispatch(func() {
			resizeWindowOnScreen(req.Width, req.Height)
		})
	}
	w.WriteHeader(http.StatusOK)
}
