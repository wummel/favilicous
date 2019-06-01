/*global $ */

/**
 * The background page.
 * @private
 */
var bgPage = null;


/**
 * Get stored bookmark folders.
 * @return {Object<string, number>}
 * @private
 */
function getBookmarkFolders() {
    return bgPage.bookmarkFolders;
}


/**
 * Set stored bookmark folders.
 * @param {Object<string, number>} bookmarkFolders
 * @private
 */
function setBookmarkFolders(bookmarkFolders) {
    bgPage.bookmarkFolders = bookmarkFolders;
}


/**
 * Register bookmark change listeners and display bookmarks.
 * @public
 */
function initBookmarks() {
    if (!bgPage.bookmarksInitialized) {
        bgPage.bookmarksInitialized = true;
        browser.bookmarks.onChanged.addListener(clearCache);
        // XXX unsupported in Firefox
        //browser.bookmarks.onChildrenReordered.addListener(clearCache);
        browser.bookmarks.onCreated.addListener(clearCache);
        // XXX unsupported in Firefox
        //browser.bookmarks.onImportEnded.addListener(clearCache);
        browser.bookmarks.onMoved.addListener(clearCache);
        browser.bookmarks.onRemoved.addListener(clearCache);
    }
    displayBookmarks();
}


/**
 * Log errors to console.
 * @param {string} error message
 * @private
 */
function logError(msg) {
    console.error('Favilicous error: ' + msg);
}


/**
 * Display the bookmark folders and links.
 * Needs the "bookmarks" permission.
 * @private
 */
function displayBookmarks() {
    browser.bookmarks.getTree().then(handleRoot, logError);
}


/**
 * Clear cached html and bookmark folders and redisplay bookmarks.
 * Called when bookmark data changes.
 * @private
 */
function clearCache() {
    window.location.reload(true);
}


/**
 * Display bookmarks from root node.
 * @param {Array<BookmarkTreeNode>} Array with root bookmark folder
 * @private
 */
function handleRoot(tree) {
    $('#bookmarks').empty();
    tree.forEach(function(root) {
        if (root.children) {
            root.children.forEach(function(child) {
                // Several folders, eg. the 'Bookmark Bar' and 'Other Bookmarks' are immediate
                // children of the root bookmark.
                handleRootfolder(child);
            });
        }
    });
    // arrange in a masonry
    $('#bookmarks').masonry({
        columnWidth: 50,
        itemSelector: '.grid-item',
        gutter: 1
    });
    fillBookmarkFolders(tree);
}


/**
 * Fill global bookmarkFolders variable.
 * @param {Array<BookmarkTreeNode>} tree Array with root bookmark folder
 * @private
 */
function fillBookmarkFolders(tree) {
    var bookmarkFolders = getBookmarkFolders();
    tree.forEach(function(root) {
        if (root.children) {
            root.children.forEach(function(child) {
                bookmarkFolders[child.id] = 1;
                if (child.children) {
                    child.children.forEach(function(entry) {
                        if (entry.url === undefined)
                            bookmarkFolders[entry.id] = 1;
                    });
                }
            });
        }
    });
}


/**
 * Check if given URL should be ignored.
 * Ignored URLs are place: and data: URLs.
 * @param {string} url the URL to check
 * @return {bool} true if URL is to be ignored, else false
 * @private
 */
function ignoreLink(url) {
    return (url.lastIndexOf('place:', 0) === 0 ||
            url.lastIndexOf('data:', 0) === 0);
}


/**
 * Display bookmarks from root folder.
 * @param  {BookmarkTreeNode} bookmark the bookmark folder node
 * @private
 */
function handleRootfolder (bookmark) {
    if (!bookmark.children) return;
    // track if folder has links
    var hasLinkAlone = false;
    bookmark.children.forEach(function(child) {
        if (child.type == 'bookmark') {
            // it is a link
            if (!ignoreLink(child.url)) {
                if (!hasLinkAlone) {
                    // make div for links
                    $('#bookmarks').append(getFolderHtml(bookmark));
                    hasLinkAlone = true;
                }
                $('#'+bookmark.id+' ul').append(getLinkHtml(child));
            }
        } else if (child.type == 'folder') {
            // it is a folder
            handleFolder(child);
        } else if (child.type == 'separator') {
            // ignore
        } else {
            logError('unknown bookmark type in root folder: ' + child.type);
        }
    });
}


/**
 * Callback function for subfolders.
 * @param {BookmarkTreeNode} bookmark the bookmark folder node
 * @private
 */
function handleFolder (bookmark) {
    if (!bookmark.children) return;
    // create new div element to store folder links
    $('#bookmarks').append(getFolderHtml(bookmark));
    var divUl = $('#'+bookmark.id+' ul');
    fillFolder(bookmark.children, divUl, bookmark.id);
}


/**
 * Fill a div with folder children
 * @param {Array<BookmarkTreeNode>} children the folder children
 * @param {Element} divUl the <div><ul> element to write into
 * @param {string} divId the <div id=""> ID
 * @private
 */
function fillFolder(children, divUl, divId) {
    children.forEach(function(child) {
        if (child.type == 'bookmark') {
            if (!ignoreLink(child.url)) {
                // add link to list
                divUl.append(getLinkHtml(child));
            }
        } else if (child.type == 'folder') {
            // add folder link
            divUl.append(getSubfolderHtml(child));
            $('#'+child.id).click(getChangeFolderFunc(divId, child.id));
        } else if (child.type == 'separator') {
            // add separator
            divUl.append('<li><hr/></li>');
        } else {
            logError('unknown bookmark type in folder: ' + child.type);
        }
    });
}


/**
 * Get function for a folder to display after changing into it
 * @param {string} divId the <div id=""> id to display folder contents in
 * @param {string} folderId the bookmark folder id
 * @private
 */
function getChangeFolderFunc(divId, folderId) {
    return function() {
        changeFolder(divId, folderId);
        return false;
    };
}


/**
 * Replace div contents with children of a certain folder.
 * @param {string} divId the id of <div> element
 * @param {BookmarkTreeNode} folder the folder node
 * @param {Array<BookmarkTreeNode>} children list of folder children nodes
 * @private
 */
function replaceFolderChildren(divId, folder, children) {
    var div = $('#' + divId);
    var divUl = div.find('ul');
    var divTitle = div.find('.group_title');
    // empty current div
    divTitle.empty();
    divUl.empty();
    var title = getBookmarkTitle(folder);
    divTitle.append(title);
    // now fill it
    fillFolder(children, divUl, divId)
    if (!(folder.id in getBookmarkFolders())) {
        // if it is not a direct child of a root folder add link to go back
        var html = '<li><a id="b' + folder.id +
          '" class="group_back">&lt;&lt; Back</a></li>';
        divUl.append(html);
        $('#b'+folder.id).click(getChangeFolderFunc(divId, folder.parentId));
    }
    div.fadeIn('fast');
    $('#bookmarks').masonry({
        singleMode: true
    });
}


/**
 * Replace div contents with bookmarks of given folder ID.
 * @param {string} divId id of <div> element
 * @param {string} folderId id of bookmark folder node
 * @public
 */
function changeFolder(divId, folderId) {
    console.log('div='+divId+' folder='+folderId);
    $('#' + divId).hide();
    browser.bookmarks.get(folderId).then(
        function (result) {
            var folder = result[0];
            browser.bookmarks.getChildren(folderId).then(
                function (children) {
                    replaceFolderChildren(divId, folder, children);
                },
                logError);
        },
        logError);
}


/**
 * Get display title of bookmark node.
 * @param {BookmarkTreeNode} bookmark The bookmark node
 * @private
 * @return {string}
 */
function getBookmarkTitle(bookmark) {
    var s = bookmark.title;
    if (s.length < 1) {
        // use URL name without scheme if there is no title
        s = removeScheme(bookmark.url);
    }
    return s;
}


/**
 * Get HTML for bookmark link.
 * @param {BookmarkTreeNode} bookmark The bookmark node
 * @private
 * @return {string}
 */
function getLinkHtml(bookmark) {
    var hoverTitle = ' title="' + attrquote(bookmark.title) + '"';
    return '<li><a href="' + attrquote(bookmark.url) + '"' + hoverTitle +
        '>' + getFavicon(bookmark.url) +
        htmlquote(getBookmarkTitle(bookmark)) + '</a></div></li>';
}


/**
 * Get HTML for bookmark folder.
 * @param {BookmarkTreeNode} bookmark The bookmark folder node
 * @private
 * @return {string}
 */
function getFolderHtml (bookmark) {
    var title = getBookmarkTitle(bookmark);
    var hoverTitle = ' title="' + attrquote(bookmark.title) + '"';
    return '<div class="grid-item" id="'+bookmark.id+
           '"><a class="group_title"' + hoverTitle + '>' +
           htmlquote(title) + '</a><ul></ul></div>';
}


/**
 * Get HTML for bookmark subfolder.
 * @param {BookmarkTreeNode} folder The bookmark folder node
 * @private
 * @return {string}
 */
function getSubfolderHtml(folder) {
    var title = getBookmarkTitle(folder);
    var hoverTitle = ' title="'+attrquote(folder.title)+'"';
    return '<li><a id="' + folder.id + '"' + hoverTitle + '>' +
           getFavicon(folder.url) + '<b>' + htmlquote(title) +
           '</b></a></li>';
}


/**
 * Get HTML to favicon image or empty string.
 * @param {string} url The favicon URL.
 * @private
 * @return {string}
 */
function getFavicon(url) {
    var src=getFaviconSrc(url);
    return '<img class="favicon" src="'+attrquote(src)+'" width="16" height="16"/>';
}


/**
 * Get URL to favicon image or folder image.
 * Needs the "chrome://favicon/" permission.
 * @param {string} url The bookmark URL.
 * @private
 * @return {string}
 */
function getFaviconSrc(url) {
    if (url !== undefined && url !== '') {
        var ipv4_address_regex = /^([0-9]+\.){3}[0-9]+$/;
        // use favicon url chrome://favicon/$url
        // XXX favicon cache is not supported in Firefox
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1315616
        //return 'chrome://favicon/' + url;
        var urlObject = new URL(url);
        if (!urlObject.protocol.startsWith('http') ||
            urlObject.hostname === 'localhost' ||
            urlObject.hostname.match(ipv4_address_regex) ||
            !window.navigator.onLine) {
            // use plain bookmark icon
            return 'images/bookmark.png';
        }
        // use unofficial(?) favicon cache from githubusercontent
        return 'https://favicons.githubusercontent.com/' + urlObject.host;
    }
    // per default return a folder icon
    return 'images/folder.png';
}


/**
 * Quote an HTML attribute value by HTML-encoding all double quotes.
 * @param {string} value the attribute value to quote
 * @private
 * @return {string}
 */
function attrquote(value) {
    return value.replace(/"/g, '&quot;');
}


/**
 * Quote an HTML text by HTML-encoding ampersands and
 * tag characters.
 * @param {string} value the text to quote
 * @private
 * @return {string}
 */
function htmlquote(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;');
}


/**
 * Remove scheme from URL
 * http://www.example.com/bla --> www.example.com/bla
 * @param {string} url The bookmark URL.
 * @private
 * @return {string}
 */
function removeScheme(url) {
    if (url.indexOf(':') !== -1)
        url = url.substring(0, url.indexOf(':'));
    // remove leading '//'
    url = url.replace(/^\/\//, '');
    return url;
}


/**
 * Initialize bookmarks on page load.
 */
document.addEventListener('DOMContentLoaded', function () {
    initI18nHtml();
    bgPage = browser.extension.getBackgroundPage();
    if (bgPage) {
        $('#bgPageNotReady').hide();
        initBookmarks();
    }
    else {
        // since the background.html takes a while to start, and
        // getBackgroundPage() returns null before that, try again after
        // a short wait time.
        window.setTimeout(function() {
            window.location.reload(true);
        }, 250);
    }
});
