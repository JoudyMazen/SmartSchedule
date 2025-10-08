import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from "react-bootstrap";

const ResetPasswordPage: React.FC = () => {
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token && router.isReady) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token, router.isReady]);

  const checkPasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordStrength(checkPasswordStrength(value));
    if (error) setError("");
  };

  const validateForm = (): boolean => {
    if (!password) {
      setError("Password is required");
      return false;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }

    if (passwordStrength < 3) {
      setError("Password is too weak. Include uppercase, lowercase, numbers, and special characters");
      return false;
    }

    if (!confirmPassword) {
      setError("Please confirm your password");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    if (!token) {
      setError("Invalid reset token");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token as string,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/auth/login");
        }, 3000);
      } else {
        setError(data.message || "Failed to reset password. Please try again.");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordStrengthIndicator: React.FC = () => {
    const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
    const strengthColors = ["#dc3545", "#dc3545", "#fd7e14", "#ffc107", "#20c997", "#198754"];
    
    return (
      <div className="mt-2">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <small className="text-muted">Password Strength:</small>
          <small style={{ color: strengthColors[passwordStrength] }} className="fw-bold">
            {strengthLabels[passwordStrength]}
          </small>
        </div>
        <div className="progress" style={{ height: "4px" }}>
          <div 
            className="progress-bar" 
            style={{ 
              width: `${(passwordStrength / 5) * 100}%`,
              backgroundColor: strengthColors[passwordStrength]
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <link 
        rel="stylesheet" 
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
      />

      <div 
        className="min-vh-100 d-flex align-items-center justify-content-center py-5"
        style={{ 
          background: 'linear-gradient(135deg, #1e3a5f 0%, #87CEEB 100%)'
        }}
      >
        <Container>
          <Row className="justify-content-center">
            <Col md={6} lg={5} xl={4}>
              <Card className="shadow-lg border-0" style={{ borderRadius: '20px' }}>
                <Card.Header 
                  className="text-white text-center py-4 border-0"
                  style={{ 
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                    borderRadius: '20px 20px 0 0'
                  }}
                >
                  <div className="mb-3">
                    <i className="fas fa-lock" style={{ fontSize: '3rem' }}></i>
                  </div>
                  <h2 className="mb-1 fw-bold">Reset Password</h2>
                  <p className="mb-0 opacity-75">Enter your new password</p>
                </Card.Header>
                
                <Card.Body className="p-4 p-md-5">
                  {success ? (
                    <Alert variant="success" className="border-0">
                      <div className="text-center">
                        <i className="fas fa-check-circle mb-3" style={{ fontSize: '3rem', color: '#198754' }}></i>
                        <h5 className="mb-2">Password Reset Successful!</h5>
                        <p className="mb-0">
                          Your password has been reset successfully. Redirecting to login...
                        </p>
                        <Spinner animation="border" size="sm" className="mt-3" />
                      </div>
                    </Alert>
                  ) : (
                    <>
                      {error && (
                        <Alert variant="danger" className="d-flex align-items-center border-0">
                          <i className="fas fa-exclamation-circle me-2"></i>
                          {error}
                        </Alert>
                      )}

                      <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                            <i className="fas fa-lock me-2"></i>
                            New Password
                          </Form.Label>
                          <div className="position-relative">
                            <Form.Control
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => handlePasswordChange(e.target.value)}
                              placeholder="Enter your new password"
                              className="py-3 border-2 pe-5"
                              style={{ borderColor: '#87CEEB' }}
                              disabled={isLoading || !token}
                            />
                            <Button
                              variant="link"
                              className="position-absolute end-0 top-50 translate-middle-y"
                              style={{ zIndex: 10, color: '#1e3a5f', textDecoration: 'none' }}
                              onClick={() => setShowPassword(!showPassword)}
                              type="button"
                            >
                              <i className={`fas ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                            </Button>
                          </div>
                          {password && <PasswordStrengthIndicator />}
                          <Form.Text className="text-muted">
                            Must include uppercase, lowercase, numbers, and special characters
                          </Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-4">
                          <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                            <i className="fas fa-lock me-2"></i>
                            Confirm New Password
                          </Form.Label>
                          <div className="position-relative">
                            <Form.Control
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                if (error) setError("");
                              }}
                              placeholder="Confirm your new password"
                              className="py-3 border-2 pe-5"
                              style={{ borderColor: '#87CEEB' }}
                              disabled={isLoading || !token}
                            />
                            <Button
                              variant="link"
                              className="position-absolute end-0 top-50 translate-middle-y"
                              style={{ zIndex: 10, color: '#1e3a5f', textDecoration: 'none' }}
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              type="button"
                            >
                              <i className={`fas ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                            </Button>
                          </div>
                          {confirmPassword && password === confirmPassword && (
                            <small className="text-success">
                              <i className="fas fa-check-circle me-1"></i>
                              Passwords match
                            </small>
                          )}
                        </Form.Group>

                        <Button
                          type="submit"
                          className="w-100 py-3 fw-bold border-0 shadow-sm"
                          disabled={isLoading || !token}
                          size="lg"
                          style={{ 
                            background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                            borderRadius: '12px'
                          }}
                        >
                          {isLoading ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Resetting Password...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-check me-2"></i>
                              Reset Password
                            </>
                          )}
                        </Button>
                      </Form>
                    </>
                  )}

                  <div className="text-center mt-4">
                    <a 
                      href="/auth/login" 
                      className="text-decoration-none d-flex align-items-center justify-content-center"
                      style={{ color: '#1e3a5f' }}
                    >
                      <i className="fas fa-arrow-left me-2"></i>
                      Back to Login
                    </a>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
};

export default ResetPasswordPage;