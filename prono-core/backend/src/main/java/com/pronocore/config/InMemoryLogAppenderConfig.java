package com.pronocore.config;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import com.pronocore.logging.InMemoryLogAppender;
import jakarta.annotation.PostConstruct;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

/** Attaches {@link InMemoryLogAppender} to the root logger at startup, on top of the default console appender. */
@Configuration
public class InMemoryLogAppenderConfig {

    @PostConstruct
    public void register() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        InMemoryLogAppender appender = new InMemoryLogAppender();
        appender.setContext(context);
        appender.start();
        context.getLogger(Logger.ROOT_LOGGER_NAME).addAppender(appender);
    }
}
