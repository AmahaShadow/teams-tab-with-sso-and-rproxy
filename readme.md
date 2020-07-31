# Teams Reverse proxy with SSO authentication
This repository is mostly based on the example by Urmade (https://github.com/Urmade/TeamsTabSSO) and implement a reverse proxy to a php based application, with SSO authentication.

It was designed as a test to publish an internal app for our salesforce calling a pre-existing intranet (with slight modifications, but still avoinding re-writing the entire software stack in NodeJS). 
It supports https and sessions (memorystore).

This sends the php App session data (user oid in azure, theme, client type, ...) as well as a scope variable (in this case, the customer ID), the current page (iTab) and any values from forms or url params (GET only) so they can be validated php-side.

Upon first opening the tab, the page will call itself and try to resolve the SSO from the current Teams user agains oAuth servers, decode the answer, and retrieve the Azure oid. It will also pass the context (Light/dark theme and client type (mobile/desktop)). It will then refresh itself until the sso has been decoded and the result stored in session, and then start reverse-proxying to the php endpoint.

Also, OCD Warning, I'm unfamiliar with NodeJS and this probably contains horrible pieces of code, but it works. I would strongly recommend against using this as-is for a public app however.

This is published here as a reference for people trying to understand Teams integration, as the official documentation leaves a lot to be desired.
The production version is a bit better and has a few more checks, but, as I said, reference....
