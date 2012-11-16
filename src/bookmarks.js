/**
 * Maximum bookmark title length. Titles longer than this are cut off
 * and displayed only on mouseover.
 * @type {number}
 */
var MAX_TITLE_LENGTH = 27;


/**
 * The background page.
 * @private
 */
var bgPage = chrome.extension.getBackgroundPage();


/**
 * Get stored bookmark folders.
 * @return {Object<string, number>}
 * @private
 */
function getBookmarkFolders () {
    return bgPage.bookmarkFolders;
}


/**
 * Set stored bookmark folders.
 * @param {Object<string, number>} bookmarkFolders
 * @private
 */
function setBookmarkFolders (bookmarkFolders) {
    bgPage.bookmarkFolders = bookmarkFolders;
}


/**
 * Register bookmark change listeners, register context menu entries and
 * display bookmarks.
 * Needs the "contextMenus" permission.
 * @public
 */
function initBookmarks () {
    if (!bgPage.bookmarksInitialized) {
        bgPage.bookmarksInitialized = true;
        chrome.bookmarks.onChanged.addListener(clearCache);
        chrome.bookmarks.onChildrenReordered.addListener(clearCache);
        chrome.bookmarks.onCreated.addListener(clearCache);
        chrome.bookmarks.onImportEnded.addListener(clearCache);
        chrome.bookmarks.onMoved.addListener(clearCache);
        chrome.bookmarks.onRemoved.addListener(clearCache);
        // add menu entry to remove bookmark on right-click
        var info = {
            title: chrome.i18n.getMessage('RemoveBookmark'),
            contexts:['link'],
            onclick: removeBookmark,
            documentUrlPatterns: [chrome.extension.getURL('newtab.html')]
        };
        // Logs error for versions earlier than rev92609 (>=14.0.825.0)
        // See http://code.google.com/p/chromium/issues/detail?id=51461
        chrome.contextMenus.create(info, logError);
    }
    displayBookmarks();
}


/**
 * Log to console if chrome had an error.
 * @public
 */
function logError () {
    if (chrome.extension.lastError) {
        console.error("Error: "+chrome.extension.lastError);
    }
}


/**
 * Remove bookmark from favorites.
 * @param {info} Information about the item clicked and the context
 *     where the click happened.
 * @param {Tab} The details of the tab where the click took place.
 * @private
 */
function removeBookmark (info, tab) {
    if (info.linkUrl !== undefined && info.linkUrl !== '') {
        chrome.bookmarks.search(info.linkUrl, removeBookmarks);
    }
}


/**
 * Remove bookmarks
 * @param {array of BookmarkTreeNode } bookmark nodes
 * @private
 */
function removeBookmarks (nodes) {
    nodes.forEach(function (node) {
        chrome.bookmarks.remove(node.id);
    });
}


/**
 * Display the bookmark folders and links.
 * Needs the "bookmarks" permission.
 * @private
 */
function displayBookmarks() {
    chrome.bookmarks.getTree(handleRoot);
}


/**
 * Clear cached html and bookmark folders and redisplay bookmarks.
 * Called when bookmark data changes.
 * @private
 */
function clearCache () {
    displayBookmarks();
}


/**
 * Display bookmarks from root node.
 * @param {Array<BookmarkTreeNode>} Array with root bookmark folder
 * @private
 */
function handleRoot (tree) {
    $('#bookmarks').empty();
    tree.forEach(function(root) {
        if (root.children) {
            root.children.forEach(function(child) {
                // The 'Bookmark Bar' and 'Other Bookmarks' are immediate
                // children of the root bookmark.
                // Note however that they do not always have id '1' and '2'!
                handleRootfolder(child);
            });
        }
    });
    // arrange in a masonry
    $('#bookmarks').masonry({
        singleMode: true
    });
    fillBookmarkFolders(tree);
}


/**
 * Fill global bookmarkFolders variable.
 * @param tree {Array<BookmarkTreeNode>} Array with root bookmark folder
 * @private
 */
function fillBookmarkFolders (tree) {
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
 * Display bookmarks from root folder.
 * @param  bookmark {BookmarkTreeNode} the bookmark folder node
 * @private
 */
function handleRootfolder (bookmark) {
    if (!bookmark.children) return;
    // track if folder has links
    var hasLinkAlone = false;
    bookmark.children.forEach(function(child) {
        if (child.url !== undefined) {
            // it is a link
            if (!hasLinkAlone) {
                // make div for links
                $('#bookmarks').append(getFolderHtml(bookmark));
                $('#'+bookmark.id+' span').click(function() {
                  openInTabs(bookmark.id);
                  return false;
                });
                hasLinkAlone = true;
            }
            $('#'+bookmark.id+' ul').append(getLinkHtml(child));
        } else {
            // it is a folder
            handleFolder(child);
        }
    });
}


/**
 * Callback function for subfolders.
 * @param {BookmarkTreeNode} the bookmark folder node
 * @private
 */
function handleFolder (bookmark) {
    if (!bookmark.children) return;
    // create new div element to store folder links
    $('#bookmarks').append(getFolderHtml(bookmark));
    $('#'+bookmark.id+' span').click(function() {
      openInTabs(bookmark.id);
      return false;
    });
    for (var i = 0; i < bookmark.children.length; i++) {
        var child = bookmark.children[i];
        if (child.url !== undefined) {
            // add link to list
            $('#'+bookmark.id+' ul').append(getLinkHtml(child));
        } else {
            // add folder link
            var html = '<li><a id="' + child.id + '">' + getFavicon(child.url) +
                '<b>' + htmlquote(getBookmarkTitle(child)) + '</b></a></li>';
            $('#'+bookmark.id+' ul').append(html);
            $('#'+child.id).click(getChangeFolderFunc(bookmark.id, child.id));
        }
    }
}


function getChangeFolderFunc(divId, folderId) {
    return function() {
      changeFolder(divId, folderId);
      return false;
    };
}


/**
 * Replace div contents with children of a certain folder.
 * @param {string} the id of <div> element
 * @param {BookmarkTreeNode} the folder node
 * @param {Array<BookmarkTreeNode>} list of folder children nodes
 * @private
 */
function replaceFolderChildren(divId, folder, children) {
    var div = $('#' + divId);
    var divUl = div.find('ul');
    var divTitle = div.find('.group_title');
    // empty current div
    divTitle.empty();
    divUl.empty();
    divTitle.append(getBookmarkTitle(folder));
    // now fill it
    children.forEach(function (child) {
        if (child.url !== undefined) {
            // add link to list
            divUl.append(getLinkHtml(child));
        } else {
            // add link to go to subfolder
            divUl.append(getSubfolderHtml(folder, child));
            $('#'+child.id).click(getChangeFolderFunc(divId, child.id));
        }
    });
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
 * @param {string} id of <div> element
 * @param {string} id of bookmark folder node
 * @public
 */
function changeFolder(divId, folderId) {
    console.log('div='+divId+' folder='+folderId);
    $('#' + divId).fadeOut('fast');
    chrome.bookmarks.get(folderId, function (result) {
        var folder = result[0];
        chrome.bookmarks.getChildren(folderId, function (children) {
            replaceFolderChildren(divId, folder, children);
        });
    });
}


/**
 * Get display title of bookmark node.
 * @param {BookmarkTreeNode} bookmark The bookmark node
 * @private
 * @return {string}
 */
function getBookmarkTitle (bookmark) {
    if (bookmark.title.length > MAX_TITLE_LENGTH) {
        // limit title length
        return bookmark.title.substring(0, 25) + '...';
    }
    if (bookmark.title.length < 1) {
        // use URL name without scheme if there is no title
        return removeScheme(bookmark.url);
    }
    return bookmark.title;
}


/**
 * Get HTML for bookmark link.
 * @param {BookmarkTreeNode} bookmark The bookmark node
 * @private
 * @return {string}
 */
function getLinkHtml (bookmark) {
    var title = getBookmarkTitle(bookmark);
    var hoverTitle = '';
    if (bookmark.title.length > MAX_TITLE_LENGTH) {
        hoverTitle = ' title="'+attrquote(bookmark.title)+'"';
    }
    return '<li><a href="' + attrquote(bookmark.url) + '"' + hoverTitle + '>' +
           getFavicon(bookmark.url) + htmlquote(title) + '</a></li>';
}


/**
 * Get HTML for bookmark folder.
 * @param {BookmarkTreeNode} bookmark The bookmark folder node
 * @private
 * @return {string}
 */
function getFolderHtml (bookmark) {
    var title = getBookmarkTitle(bookmark);
    var hoverTitle = 'Open in tabs';
    if (bookmark.title.length > MAX_TITLE_LENGTH) {
        hoverTitle += ': ' + bookmark.title;
    }
    return '<div class="cont" id="'+bookmark.id+
           '"><span class="group_title" title="' + attrquote(hoverTitle) + '">'+
           htmlquote(title)+'</span><ul></ul></div>';
}


/**
 * Get HTML for bookmark subfolder.
 * @param {BookmarkTreeNode} parent The bookmark parent folder node
 * @param {BookmarkTreeNode} folder The bookmark folder node
 * @private
 * @return {string}
 */
function getSubfolderHtml (parent, folder) {
    var title = getBookmarkTitle(folder);
    var hoverTitle = 'Click to open';
    if (folder.title.length > MAX_TITLE_LENGTH) {
        hoverTitle = ' title="'+attrquote(folder.title)+'"';
    }
    return '<li><a id="' + folder.id + '"' + hoverTitle + ">" +
           getFavicon(folder.url) + '<b>' + htmlquote(title) + '</b></a></li>';
}


/**
 * Open all links of folder in new tabs and close the current one.
 * Needs the "tabs" permission.
 * @param {string} id The <div> folder element id
 * @public
 */
function openInTabs(id) {
    // handle each <a> entry
    $('#' + id + ' ul li a').each( function(i, val) {
        // open new tab with url
        if (val !== '')
            chrome.tabs.create({
                url: val + ''
            });
    });
    // close current tab
    chrome.tabs.getCurrent( function(tab) {
        chrome.tabs.remove(tab.id);
    });
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
        if (chrome.extension.inIncognitoContext) {
            // incognito has no access to favicon cache for >= M13
            return 'images/bookmark.png';
        }
        // use favicon url chrome://favicon/$url
        return 'chrome://favicon/' + url;
    }
    // per default return a folder icon
    return 'images/folder.png';
}

/**
 * Quote an HTML attribute value by HTML-encoding all double quotes.
 * @param value {string} the attribute value to quote
 * @private
 * @return {string}
 */
function attrquote(value) {
    return value.replace(/\"/g, "&quot;");
}


/**
 * Quote an HTML text by HTML-encoding ampersands and
 * tag characters.
 * @param value {string} the text to quote
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
    if (bgPage) {
        $('#bgPageNotReady').hide();
        initBookmarks();
    }
    else {
        // since google chrome background.html takes a while to start, and
        // getBackgroundPage() returns null before that, try again after
        // a short wait time.
        window.setTimeout(function() {
          bgPage=chrome.extension.getBackgroundPage();
          initBookmarks();
        }, 250);
    }
});
