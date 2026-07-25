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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;

@Aspect
@Component
@Slf4j
public class ControllerLoggingAspect {

    @Before("execution(* com.pronocore.controller..*(..))")
    public void logControllerEntry(JoinPoint joinPoint) {
        Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
        String methodName = method.getName();
        String controllerName = joinPoint.getTarget().getClass().getSimpleName();
        String username = resolveUsername();
        String params = resolveLoggableParams(method, joinPoint.getArgs());

        Level level = resolveLevel(method);
        String message = params.isEmpty() ? "[{}#{}] user={}" : "[{}#{}] user={} {}";
        Object[] args = params.isEmpty()
                ? new Object[]{controllerName, methodName, username}
                : new Object[]{controllerName, methodName, username, params};

        switch (level) {
            case INFO  -> log.info(message, args);
            case WARN  -> log.warn(message, args);
            case ERROR -> log.error(message, args);
            case TRACE -> log.trace(message, args);
            default    -> log.debug(message, args);
        }
    }

    /** Path/query identifiers (raceId, matchId, groupId, sport, ...) so a log line pinpoints which resource the call targets. */
    private String resolveLoggableParams(Method method, Object[] args) {
        Parameter[] parameters = method.getParameters();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parameters.length; i++) {
            Parameter parameter = parameters[i];
            String paramName = null;

            PathVariable pathVariable = parameter.getAnnotation(PathVariable.class);
            RequestParam requestParam = parameter.getAnnotation(RequestParam.class);
            if (pathVariable != null) {
                paramName = !pathVariable.value().isEmpty() ? pathVariable.value() : parameter.getName();
            } else if (requestParam != null) {
                paramName = !requestParam.value().isEmpty() ? requestParam.value() : parameter.getName();
            }

            if (paramName != null) {
                if (sb.length() > 0) sb.append(", ");
                sb.append(paramName).append('=').append(args[i]);
            }
        }
        return sb.toString();
    }

    private Level resolveLevel(Method method) {
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
