package com.specmerger;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SpecMergerApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpecMergerApplication.class, args);
    }
}
