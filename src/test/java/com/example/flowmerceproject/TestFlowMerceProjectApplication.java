package com.example.flowmerceproject;

import org.springframework.boot.SpringApplication;

public class TestFlowMerceProjectApplication {

    public static void main(String[] args) {
        SpringApplication.from(FlowMerceProjectApplication::main).with(TestcontainersConfiguration.class).run(args);
    }

}
