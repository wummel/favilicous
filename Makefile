# Makefile for building the favilicous extension for Mozilla Firefox
base_name := favilicous
version := $(shell python -c "import json;print json.load(open('src/manifest.json'))['version']")
release_name := $(base_name)-$(version)
build_dir := build
dist_dir := dist
web_ext := web-ext
# web-ext documentation
# https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Getting_started_with_web-ext
# npm install --global web-ext

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
	@python -c "import json; d=json.load(open('src/manifest.json')); print 'Old version:', d['version']"
	@python -c "import json; d=json.load(open('src/manifest.json')); v = d['version'].split('.'); v[0] = str(int(v[0])+1); v[1] = '0'; d['version'] = u'.'.join(v); fh = open('src/manifest.json', 'w'); json.dump(d, fh, indent=2, sort_keys=True, separators=(',', ': ')); fh.flush(); fh.close()"
	@python -c "import json; d=json.load(open('src/manifest.json')); print 'New version:', d['version']"

# bump the minor part of version number
bumpversion-minor:
	@python -c "import json; d=json.load(open('src/manifest.json')); print 'Old version:', d['version']"
	@python -c "import json; d=json.load(open('src/manifest.json')); v = d['version'].split('.'); v[1] = str(int(v[1])+1); d['version'] = u'.'.join(v); fh = open('src/manifest.json', 'w'); json.dump(d, fh, indent=2, sort_keys=True, separators=(',', ': ')); fh.flush(); fh.close()"
	@python -c "import json; d=json.load(open('src/manifest.json')); print 'New version:', d['version']"

# use visual-studio-code
ide:
	code .

run:
	cd src && $(web_ext) run

lint:
	cd src && $(web_ext) lint

jslint:
	eslint src/background.js src/bookmarks.js src/language.js

.PHONY: all ide lint jslint clean dist build bumpversion-minor bumpversion-major release releasecheck
