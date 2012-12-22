base_name := favilicous
version := $(shell python -c "import json;print json.load(open('src/manifest.json'))['version']")
release_name := $(base_name)-$(version)
build_dir := build
dist_dir := dist
chrome := /usr/bin/chromium
jquery_version := 1.8.3


all:
	@echo "Available targets: ide icons favicons jslint clean dist build"

build:	build-stamp
build-stamp:
	@echo "[BUILD] copying files..."
	@mkdir -p $(build_dir)
	@cp -r src/* $(build_dir)
	@chmod -R a+rX,u+w,go-w -- $(build_dir)
	@rm $(build_dir)/jquery-$(jquery_version).js
	@mv $(build_dir)/jquery-$(jquery_version).min.js $(build_dir)/jquery-$(jquery_version).js
	@echo "[BUILD] compressing files..."
	@python $(HOME)/src/mediacompress.py --overwrite=png,js,css,json --exclude=jquery- $(build_dir)
	touch $@

dist:	build-stamp dist-stamp
dist-stamp:
	@echo "[DIST] creating CRX package..."
	mkdir -p $(dist_dir)
	ln -s $(build_dir) $(base_name)
	$(chrome) --pack-extension=$(base_name) --pack-extension-key=$(base_name).pem
	rm $(base_name)
	mv $(base_name).crx $(dist_dir)/$(release_name).crx
	sed -e "s/VERSION/$(version)/g" updates.xml > $(dist_dir)/updates.xml
	@echo "[DIST] Result at $(dist_dir)/$(release_name).crx"
	touch $@

releasecheck:	jslint

release: releasecheck dist-stamp
	cp $(dist_dir)/updates.xml releases
	git add releases
	git commit -m "Release $(version)"
	git tag v$(version)
	git push
	github-upload wummel $(base_name) $(dist_dir)/$(release_name).crx

clean:
	rm -rf $(build_dir) $(dist_dir)
	rm -f $(base_name) *-stamp

bump_version:
	@python -c "import json; d=json.load(open('src/manifest.json')); print 'Old version:', d['version']"
	@python -c "import json; d=json.load(open('src/manifest.json')); v = d['version'].split('.'); v[-1] = str(int(v[-1])+1); d['version'] = u'.'.join(v); fh = open('src/manifest.json', 'w'); json.dump(d, fh, indent=2); fh.flush(); fh.close()"
	@python -c "import json; d=json.load(open('src/manifest.json')); print 'New version:', d['version']"

ide:
	eclipse -data ..

jslint:
	jsl --conf=jsl.conf

.PHONY: all ide jslint clean dist build bump_version release releasecheck
