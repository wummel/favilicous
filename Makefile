# Makefile for building the favilicous extension for Mozilla Firefox
base_name := favilicous
version := $(shell python -c "import json;print json.load(open('src/manifest.json'))['version']")
release_name := $(base_name)-$(version)
build_dir := build
dist_dir := dist
jquery_version := 2.2.4
jquery_masonry_version := 3.2.1
web_ext := web-ext
# web-ext documentation
# https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Getting_started_with_web-ext
# npm install --global web-ext

all:
	@echo "Available targets: ide icons favicons jslint clean dist build"

build:	build-stamp
build-stamp:
	@echo "[BUILD] copying files..."
	@mkdir -p $(build_dir)
	@cp -r src/* $(build_dir)
	@chmod -R a+rX,u+w,go-w -- $(build_dir)
	# replace JS files with minified versions
	@rm $(build_dir)/jquery-$(jquery_version).js
	@mv $(build_dir)/jquery-$(jquery_version).min.js $(build_dir)/jquery-$(jquery_version).js
	@rm $(build_dir)/jquery.masonry-$(jquery_masonry_version).js
	@mv $(build_dir)/jquery.masonry-$(jquery_masonry_version).min.js $(build_dir)/jquery.masonry-$(jquery_masonry_version).js
	touch $@

dist:	build-stamp dist-stamp
dist-stamp:
	@echo "[DIST] creating ZIP package..."
#	cd $(build_dir) && $(web_ext) sign --api-key=$(AMO_JWT_ISSUER) --api-secret=$(AMO_JWT_SECRET)
	cd $(build_dir) && $(web_ext) build
	@echo "[DIST] Result at $(dist_dir)/web_ext_release/
	touch $@

releasecheck:	jslint

release: releasecheck
	git tag upstream/$(version)
	git push --tags origin upstream/$(version)

clean:
	rm -rf $(build_dir) $(dist_dir)
	rm -f $(base_name) *-stamp

bump_version:
	@python -c "import json; d=json.load(open('src/manifest.json')); print 'Old version:', d['version']"
	@python -c "import json; d=json.load(open('src/manifest.json')); v = d['version'].split('.'); v[-1] = str(int(v[-1])+1); d['version'] = u'.'.join(v); fh = open('src/manifest.json', 'w'); json.dump(d, fh, indent=2, sort_keys=True, separators=(',', ': ')); fh.flush(); fh.close()"
	@python -c "import json; d=json.load(open('src/manifest.json')); print 'New version:', d['version']"

ide:
	eclipse -data ..

run:
	cd src && $(web_ext) run

jslint:
	cd src && $(web_ext) lint

.PHONY: all ide jslint clean dist build bump_version release releasecheck
