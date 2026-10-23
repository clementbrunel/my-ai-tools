auth_request /oauth2/auth;
# Navigation sans session : on part se connecter, puis retour sur la page demandée.
error_page 401 =302 /oauth2/start?rd=$request_uri;
