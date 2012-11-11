/**
 * Keep track which bookmark folder IDs are displayed. Maps bookmark IDs to
 * the number one. This way the "for .. in" loop can be used.
 * @type {Object<string, number>}
 * @private
 */
var bookmarkFolders = {};

/**
 * Store calculated bookmark HTML code for faster redisplay.
 * @type {string}
 * @private
 */
var bookmarkHtml = '';

/**
 * Store flag if bookmark menu and listeners have been initialized.
 * This way they do not get initialized more than once.
 * @type {boolean}
 * @private
 */
var bookmarksInitialized = false;
