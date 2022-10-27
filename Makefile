# Makefile for building the favilicous extension for Mozilla Firefox
base_name := favilicous
version := $(shell python3 -c "import json;print(json.load(open('src/manifest.json'))['version'])")
release_name := $(base_name)-$(version)
build_dir := build
dist_dir := dist
# web-ext documentation
# https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Getting_started_with_web-ext
node_bindir := $(CURDIR)/node_modules/.bin

all:
	@echo "Available targets: ide icons favicons lint clean dist build"

build:	build-stamp
build-stamp:
	@echo "[BUILD] copying files..."
	@mkdir -p $(build_dir)
	@cp -r src/* $(build_dir)
	@chmod -R a+rX,u+w,go-w -- $(build_dir)
	touch $@

dist:	clean build-stamp dist-stamp
dist-stamp:
	@echo "[DIST] creating ZIP package..."
#	cd $(build_dir) && $(web_ext) sign --api-key=$(AMO_JWT_ISSUER) --api-secret=$(AMO_JWT_SECRET)
	cd $(build_dir) && $(web_ext) --artifacts-dir $(dist_dir) build
	@echo "[DIST] Result at $(build_dir)/$(dist_dir)/"
	touch $@

releasecheck:	lint

release: releasecheck dist
	git tag upstream/$(version)
	git push --tags origin upstream/$(version)

clean:
	rm -rf $(build_dir)
	rm -f $(base_name) *-stamp

# bump the major part of version number
bumpversion-major:
	@python3 -c "import json; d=json.load(open('src/manifest.json')); print('Old version:', d['version'])"
	@python3 -c "import json; d=json.load(open('src/manifest.json')); v = d['version'].split('.'); v[0] = str(int(v[0])+1); v[1] = '0'; d['version'] = u'.'.join(v); fh = open('src/manifest.json', 'w'); json.dump(d, fh, indent=2, sort_keys=True, separators=(',', ': ')); fh.flush(); fh.close()"
	@python3 -c "import json; d=json.load(open('src/manifest.json')); print('New version:', d['version'])"

# bump the minor part of version number
bumpversion-minor:
	@python3 -c "import json; d=json.load(open('src/manifest.json')); print('Old version:', d['version'])"
	@python3 -c "import json; d=json.load(open('src/manifest.json')); v = d['version'].split('.'); v[1] = str(int(v[1])+1); d['version'] = u'.'.join(v); fh = open('src/manifest.json', 'w'); json.dump(d, fh, indent=2, sort_keys=True, separators=(',', ': ')); fh.flush(); fh.close()"
	@python3 -c "import json; d=json.load(open('src/manifest.json')); print('New version:', d['version'])"

checkoutdated:
	$(node_bindir)/ncu

# use visual-studio-code
ide:
	code .

# regenerate package-lock.json
package-lock.json: package.json
	npm install --package-lock-only .

# install dependencies locally into ./node-modules
install-npm: package-lock.json
	npm install .

run:
	cd src && $(node_bindir)/web-ext run

lint:	lint-js lint-npm lint-webext

lint-webext:
	cd src && $(node_bindir)/web-ext lint

# find security vulnerabilities in npm-installed packages
lint-npm:
	npm audit


lint-js:
	$(node_bindir)/eslint src/background.js src/bookmarks.js src/language.js

.PHONY: all ide lint lint-js lint-npm clean dist build bumpversion-minor bumpversion-major release releasecheck
