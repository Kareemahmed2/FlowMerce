package com.example.flowmerceproject.UserManagement.controller;

import com.example.flowmerceproject.UserManagement.service.SseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.security.Principal;

@RestController
@RequestMapping("/stream")
@RequiredArgsConstructor
public class SseController {

    private final SseService sseService;

    @GetMapping(value = "/private", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamPrivate(Principal principal) {
        return sseService.subscribeUser(principal.getName());
    }


    // SEC-13: require auth — the stock broadcast leaks inventory counts.
    // Scoped to MERCHANTs so only store owners receive real-time stock events.
    @GetMapping(value = "/stock", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamStock(Principal principal) {
        return sseService.subscribeBroadcast();
    }
}