package com.mymoneyhub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MyMoneyHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(MyMoneyHubApplication.class, args);
    }
}
