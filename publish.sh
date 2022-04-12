# https://code.visualstudio.com/api/working-with-extensions/publishing-extension

# npm install -g vsce

vsce package

# fix keytar issue (when X11 may not work in WSLg2)
# the below makes sure it fails and reverts to file store (unsafe)
# export $(dbus-launch)
# test if this works as well:
# export VSCE_STORE=~/creds.txt

vsce publish