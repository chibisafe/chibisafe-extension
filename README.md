# Chibisafe Uploader

<p align="center">
  <img height="300" src="https://chibisafe.moe/xjoghu.png">
</p>

Companion extension for the chibisafe service.

Chibisafe is an open-source self-hosted file hosting service that allows for fast and easy file uploads. This extension aims to make it easy to upload to a chibisafe instance by adding a few new options to the context menu for quick uploading.

## Features

The extension adds the following options to the context menu:

* `Send to safe`  
  Uploads the media content that was right clicked to the configured chibisafe instance.
* `Screenshot page/Screenshot selection`  
  Takes a screenshot of the current page or selection and uploads it.
* `Upload to album`  
  Just like `Send to safe`, but allows you to select an album to upload to.
  Requires that a user API key is configured.

## Install

<p>
	<a href="https://chrome.google.com/webstore/detail/chibisafe-uploader/enkkmplljfjppcdaancckgilmgoiofnj"><img src="https://raw.githubusercontent.com/alrra/browser-logos/ce0aac8/src/chrome/chrome.svg" valign="middle" height="55"></a>
	<a href="https://chrome.google.com/webstore/detail/chibisafe-uploader/enkkmplljfjppcdaancckgilmgoiofnj"><img src="https://img.shields.io/chrome-web-store/v/enkkmplljfjppcdaancckgilmgoiofnj.svg" valign="middle"></a>
	&nbsp;
	<a href="https://addons.mozilla.org/en-US/firefox/addon/chibisafe-uploader/"><img src="https://raw.githubusercontent.com/alrra/browser-logos/ce0aac8/src/firefox/firefox.svg" valign="middle" height="55"></a>
	<a href="https://addons.mozilla.org/en-US/firefox/addon/chibisafe-uploader/"><img src="https://img.shields.io/amo/v/chibisafe-uploader.svg" valign="middle"></a>
</p>

<p>
	Chrome version can be used in Edge, Vivaldi and other Chromium based browsers.
</p>

## Building

If you want to build the extension yourself and use it as an unpackaged extension, you can do so by doing the following:

* Clone the repository.
* Run `npm install` to install dependencies.
* Run `npm run build:chrome` or `npm run build:firefox` to build the extension.

The built extension will be located in the `.build` directory. Simply load this directory as an unpackaged extension in your browser.


