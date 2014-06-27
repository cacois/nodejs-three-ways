Generate your new ap

> meteor create mapit

Add some packages for built-in authentication

> meteor add accounts-password
> meteor add accounts-ui

Install meteorite, which will help us manage packages

> npm install -g meteorite

Add the Leaflet meteorite package, to add the Leaflet mapping library to our app

> mrt add leaflet

Start app

> meteor

Remove autopublish. This means we will explicitly set which collections are synced with clients.

> meteor remove autopublish
