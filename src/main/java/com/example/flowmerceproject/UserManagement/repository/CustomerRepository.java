package com.example.flowmerceproject.UserManagement.repository;

import com.example.flowmerceproject.UserManagement.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Integer> {

    Optional<Customer> findByUser_UserId(Integer userId);

    boolean existsByUser_UserId(Integer userId);
}