// SPDX-License-Identifier: GPL-2.0-only

package server

import (
	"net/http"
	"net/url"
	"strings"
)

// communityPages are the only places POST /api/open-page shows: the project's
// repository on GitHub (the collection's upload page, its issues) and its site.
var communityPages = []struct{ host, path string }{
	{"github.com", "/rollk2/Ricoh-GRModFilm/"},
	{"rollk2.github.io", "/Ricoh-GRModFilm/"},
}

// communityPage reports whether address is an https page of the project (no
// credentials, no port, no dot segments that could leave the project's path).
func communityPage(address string) bool {
	u, err := url.Parse(address)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" || u.Opaque != "" {
		return false
	}
	if strings.Contains(u.Path, "/../") || strings.HasSuffix(u.Path, "/..") || strings.Contains(u.RawPath, "%2") {
		return false
	}
	for _, p := range communityPages {
		if u.Host == p.host && strings.HasPrefix(u.Path, p.path) {
			return true
		}
	}
	return false
}

// handleOpenPage answers POST /api/open-page {url}: it shows a page of the
// project (the community collection's upload page) in the user's browser.
func (s *Server) handleOpenPage(w http.ResponseWriter, r *http.Request) error {
	opener, ok := s.opt.Host.(urlOpener)
	if !ok {
		return errf(http.StatusNotImplemented, codeInvalid, "this build cannot open a browser")
	}
	var req struct {
		URL string `json:"url"`
	}
	if err := readJSON(w, r, &req, false); err != nil {
		return err
	}
	if !communityPage(req.URL) {
		return errInvalid("not a page of the project: %q", req.URL)
	}
	if err := opener.OpenURL(req.URL); err != nil {
		return errIO("cannot open the browser: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"page": req.URL})
	return nil
}
