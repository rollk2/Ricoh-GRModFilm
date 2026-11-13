// SPDX-License-Identifier: GPL-2.0-only

package server

import "testing"

func TestCommunityPage(t *testing.T) {
	for address, want := range map[string]bool{
		"https://github.com/rollk2/Ricoh-GRModFilm/upload/main/community/recipes": true,
		"https://rollk2.github.io/Ricoh-GRModFilm/community/index.json":           true,
		"http://github.com/rollk2/Ricoh-GRModFilm/upload/main/community/recipes":  false,
		"https://github.com/rollk2/Other/upload/main":                             false,
		"https://github.com/rollk2/Ricoh-GRModFilm/../Other/":                     false,
		"https://github.com/rollk2/Ricoh-GRModFilm/x/..":                          false,
		"https://github.com/rollk2/Ricoh-GRModFilm/%2e%2e/Other":                  false,
		"https://user@github.com/rollk2/Ricoh-GRModFilm/":                         false,
		"https://github.com:8443/rollk2/Ricoh-GRModFilm/":                         false,
		"https://github.com.evil.example/rollk2/Ricoh-GRModFilm/":                 false,
		"https://evil.example/?https://github.com/rollk2/Ricoh-GRModFilm/":        false,
		"file:///etc/passwd": false,
		"":                   false,
	} {
		if got := communityPage(address); got != want {
			t.Errorf("%q: %v, want %v", address, got, want)
		}
	}
}

func TestOpenPage(t *testing.T) {
	e := newEnv(t)
	wantStatus(t, e.do("POST", "/api/open-page", map[string]string{"url": "https://github.com/rollk2/Ricoh-GRModFilm/"}), 501, codeInvalid)

	var host *openingHost
	e = newEnv(t, func(o *Options) {
		host = &openingHost{fakeHost: o.Host.(*fakeHost)}
		o.Host = host
	})
	page := "https://github.com/rollk2/Ricoh-GRModFilm/upload/main/community/ratios"
	if rec := e.do("POST", "/api/open-page", map[string]string{"url": page}); rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	wantStatus(t, e.do("POST", "/api/open-page", map[string]string{"url": "https://example.com/"}), 400, codeInvalid)
	wantStatus(t, e.do("POST", "/api/open-page", map[string]string{}), 400, codeInvalid)
	if len(host.opened) != 1 || host.opened[0] != page {
		t.Errorf("opened: %v", host.opened)
	}
}
