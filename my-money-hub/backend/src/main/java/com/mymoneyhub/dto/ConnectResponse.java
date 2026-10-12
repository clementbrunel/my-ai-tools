package com.mymoneyhub.dto;

/** Bank authorization page the browser must be sent to for the user to give consent. */
public record ConnectResponse(String url) {
}
