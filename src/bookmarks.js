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
 * Get stored bookmark HTML.
 * @return {string}
 * @private
 */
function getBookmarkHtml () {
    return bgPage.bookmarkHtml;
}


/**
 * Set stored bookmark Html.
 * @param {string} bookmarkHtml
 * @private
 */
function setBookmarkHtml (bookmarkHtml) {
    bgPage.bookmarkHtml = bookmarkHtml;
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
 * @param {OnClickData} Information about the item clicked and the context
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
    var bookmarkHtml = getBookmarkHtml();
    if (bookmarkHtml !== '') {
        $('#bookmarks').html(bookmarkHtml);
        $('#bookmarks').masonry({
            singleMode: true
        });
        chrome.bookmarks.getTree(fillBookmarkFolders);
    }
    else {
        chrome.bookmarks.getTree(handleRoot);
    }
}


/**
 * Clear cached html and bookmark folders and redisplay bookmarks.
 * Called when bookmark data changes.
 * @private
 */
function clearCache () {
    setBookmarkHtml("");
    setBookmarkFolders({});
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
        if (root.children)
            root.children.forEach(function(child) {
                // The 'Bookmark Bar' and 'Other Bookmarks' are immediate
                // children of the root bookmark.
                // Note however that they do not always have id '1' and '2'!
                handleRootfolder(child);
            });
    });
    // arrange in a masonry
    $('#bookmarks').masonry({
        singleMode: true
    });
    // cache result HTML for faster rendering
    setBookmarkHtml($('#bookmarks').html());
    fillBookmarkFolders(tree);
}


/**
 * Fill global bookmarkFolders variable.
 * @param {Array<BookmarkTreeNode>} Array with root bookmark folder
 * @private
 */
function fillBookmarkFolders (tree) {
    var bookmarkFolders = getBookmarkFolders();
    tree.forEach(function(root) {
        if (root.children)
            root.children.forEach(function(child) {
                bookmarkFolders[child.id] = 1;
                if (child.children) {
                    child.children.forEach(function(entry) {
                        if (entry.url === undefined)
                            bookmarkFolders[entry.id] = 1;
                    });
                }
            });
    });
}


/**
 * Display bookmarks from root folder.
 * @param {BookmarkTreeNode} the bookmark folder node
 * @private
 */
function handleRootfolder (bookmark) {
    if (!bookmark.children) return;
    // track if folder has links
    var hasLinkAlone = false;
    // for storing html snippets
    var html = '';
    bookmark.children.forEach(function(child) {
        if (child.url !== undefined) {
            // it is a link
            if (!hasLinkAlone) {
                // make div for links
                html = getFolderHtml(bookmark);
                $('#bookmarks').append(html);
                hasLinkAlone = true;
            }
            html = getLinkHtml(child);
            $('#'+bookmark.id+' ul').append(html);
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
    var html = getFolderHtml(bookmark);
    $('#bookmarks').append(html);
    for (var i = 0; i < bookmark.children.length; i++) {
        var child = bookmark.children[i];
        var title = getBookmarkTitle(child);
        if (child.url !== undefined) {
            // add link to list
            html = getLinkHtml(child);
        } else {
            // add folder link
            html = "<li><a onclick=\"changeFolder('"+bookmark.id+
                "', '" + child.id + "')\">" + getFavicon(child.url) +
                '<b>' + title + '</b></a></li>';
        }
        $('#'+bookmark.id+' ul').append(html);
    }
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
    var html = '';
    children.forEach(function (child) {
        if (child.url !== undefined) {
            // add link to list
            html = getLinkHtml(child);
        } else {
            // add link to go to subfolder
            html = getSubfolderHtml(folder, child);
        }
        divUl.append(html);
    });
    if (!(folder.id in getBookmarkFolders())) {
        // if its not a direct child of a root folder add link to go back
        html = "<li><a class=\"group_back\" onclick=\"changeFolder('" + 
            folder.id + "','" + folder.parentId + "')\">&lt;&lt; Back</a></li>";
        divUl.append(html);
    }
    div.fadeIn('fast');
    div.attr('id', folder.id);
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
        hoverTitle = ' title="'+bookmark.title+'"';
    }
    return '<li><a href="' + bookmark.url + '\"' + hoverTitle + '>' +
           getFavicon(bookmark.url) + title + '</a></li>';
}


/**
 * Get HTML for bookmark folder.
 * @param {BookmarkTreeNode} bookmark The bookmark folder node
 * @private
 * @return {string}
 */
function getFolderHtml (bookmark) {
    var title = getBookmarkTitle(bookmark);
    var hoverTitle = '';
    if (bookmark.title.length > MAX_TITLE_LENGTH) {
        hoverTitle = bookmark.title;
    }
    else {
        hoverTitle = 'Open in tabs';
    }
    return '<div class="cont" id="'+bookmark.id+
           "\"><span onclick=\"openInTabs('"+bookmark.id+
           "')\" class=\"group_title\" title=\"" + hoverTitle + '">'+
           title+'</span><ul></ul></div>';
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
    var hoverTitle = '';
    if (folder.title.length > MAX_TITLE_LENGTH) {
        hoverTitle = ' title="'+folder.title+'"';
    }
    return '<li><a' + hoverTitle + " onclick=\"changeFolder('" +
           parent.id + "','" + folder.id + "')\">" +
           getFavicon(folder.url) + '<b>' + title + '</b></a></li>';
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
    return '<img class="favicon" src="'+src+'" width="16" height="16"/>';
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
    url = url.replace('/^\/\//', '');
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
        // getBackgroundPage() returns null before that, wait a half a second
        // and try again.
        var waitMillis = 500;
        window.setTimeout(
          'bgPage=chrome.extension.getBackgroundPage();initBookmarks()', waitMillis);
    }
});
