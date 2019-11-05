/**
 * Keep track which bookmark folder IDs are displayed. Maps bookmark IDs to
 * the number one. This way the "for .. in" loop can be used.
 * @type {Object<string, number>}
 * @private
 */
var bookmarkFolders = {}; // eslint-disable-line no-unused-vars

/**
 * Store flag if bookmark menu and listeners have been initialized.
 * This way they do not get initialized more than once.
 * @type {boolean}
 * @private
 */
var bookmarksInitialized = false; // eslint-disable-line no-unused-vars
