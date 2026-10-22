# oauth2-proxy (mode auth_request) : gère le login Keycloak et le cookie de session.
location /oauth2/ {
    proxy_pass OAUTH2_PROXY_URL;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Auth-Request-Redirect $request_uri;
}

# Sous-requête d'auth : 202 si le cookie de session est valide, 401 sinon.
location = /oauth2/auth {
    internal;
    proxy_pass OAUTH2_PROXY_URL;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Uri $request_uri;
    proxy_set_header Content-Length "";
    proxy_pass_request_body off;
}
