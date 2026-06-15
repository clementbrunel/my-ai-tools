package com.pronocore.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.event.Level;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

@Aspect
@Component
@Slf4j
public class ControllerLoggingAspect {

    @Before("execution(* com.pronocore.controller..*(..))")
    public void logControllerEntry(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        String controllerName = joinPoint.getTarget().getClass().getSimpleName();
        String username = resolveUsername();

        Level level = resolveLevel(joinPoint);
        String message = "[{}#{}] user={}";

        switch (level) {
            case INFO  -> log.info(message, controllerName, methodName, username);
            case WARN  -> log.warn(message, controllerName, methodName, username);
            case ERROR -> log.error(message, controllerName, methodName, username);
            case TRACE -> log.trace(message, controllerName, methodName, username);
            default    -> log.debug(message, controllerName, methodName, username);
        }
    }

    private Level resolveLevel(JoinPoint joinPoint) {
        Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
        LoggedAt annotation = method.getAnnotation(LoggedAt.class);
        return annotation != null ? annotation.value() : Level.DEBUG;
    }

    private String resolveUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return "anonymous";
    }
}
