package com.pm.authservice.service;

import com.pm.authservice.dto.LoginRequestDTO;
import com.pm.authservice.metrics.AuthMetrics;
import com.pm.authservice.model.User;
import com.pm.authservice.util.JwtUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

  private final UserService userService;
  private final PasswordEncoder passwordEncoder;
  private final JwtUtil jwtUtil;
  private final AuthMetrics authMetrics;

  public AuthService(UserService userService, PasswordEncoder passwordEncoder,
      JwtUtil jwtUtil, AuthMetrics authMetrics) {
    this.authMetrics = authMetrics;
    this.userService = userService;
    this.passwordEncoder = passwordEncoder;
    this.jwtUtil = jwtUtil;
  }

  public Optional<String> authenticate(LoginRequestDTO loginRequestDTO) {
    Optional<User> user = userService.findByEmail(loginRequestDTO.getEmail());
    if (user.isEmpty()) {
      authMetrics.login("unknown_user");
      return Optional.empty();
    }
    if (!passwordEncoder.matches(loginRequestDTO.getPassword(), user.get().getPassword())) {
      authMetrics.login("bad_password");
      return Optional.empty();
    }
    authMetrics.login("success");
    return Optional.of(jwtUtil.generateToken(user.get().getEmail(), user.get().getRole()));
  }

  /** Claims of a valid token, empty when the token is invalid or expired. */
  public Optional<Claims> parseClaims(String token) {
    try {
      return Optional.of(jwtUtil.parseClaims(token));
    } catch (JwtException e) {
      return Optional.empty();
    }
  }

  public boolean validateToken(String token) {
    try {
      jwtUtil.validateToken(token);
      return true;
    } catch (JwtException e){
      return false;
    }
  }
}
