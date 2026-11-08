# Firefox distribution overlay

This directory contains default preferences intended for a future Linden Firefox distribution. It is not an installer by itself.

For the eventual package, Firefox expects a distribution directory beside the browser application. The Linden Start WebExtension must be packaged as an XPI and placed under distribution/extensions/ using its extension ID as the filename. Do not install unsigned development extensions into normal user profiles or weaken Firefox signature enforcement.

The current distribution.ini is a starting point; verify preference names and behavior against the exact Firefox version selected for the Linden build.
