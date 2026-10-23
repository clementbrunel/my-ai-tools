auth_request /oauth2/auth;
# Appel d'API sans session : 401 tel quel (pas de redirection HTML pour un XHR).
# Le JWT (ID token) renouvelé par oauth2-proxy est transmis au backend, qui le re-valide :
# il reste protégé même si on le joint en contournant nginx.
auth_request_set $oidc_authorization $upstream_http_authorization;
proxy_set_header Authorization $oidc_authorization;
