import React, { useState } from "react";
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from "react-bootstrap";

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    if (!email.trim()) {
      setError("Please enter your email address");
      setIsLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setEmail(""); // Clear the form
      } else {
        setError(data.message || "An error occurred. Please try again.");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
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
                    <i className="fas fa-key" style={{ fontSize: '3rem' }}></i>
                  </div>
                  <h2 className="mb-1 fw-bold">Forgot Password?</h2>
                  <p className="mb-0 opacity-75">No worries, we'll send you reset instructions</p>
                </Card.Header>
                
                <Card.Body className="p-4 p-md-5">
                  {success ? (
                    <Alert variant="success" className="border-0">
                      <div className="d-flex align-items-start">
                        <i className="fas fa-check-circle me-3" style={{ fontSize: '1.5rem' }}></i>
                        <div>
                          <h5 className="mb-2">Check Your Email!</h5>
                          <p className="mb-2">
                            If an account with that email exists, we've sent password reset instructions to your inbox.
                          </p>
                          <small className="text-muted">
                            <strong>Note:</strong> The link will expire in 1 hour. Don't forget to check your spam folder!
                          </small>
                        </div>
                      </div>
                    </Alert>
                  ) : (
                    <>
                      <p className="text-center text-muted mb-4">
                        Enter your email address and we'll send you a link to reset your password.
                      </p>

                      {error && (
                        <Alert variant="danger" className="d-flex align-items-center border-0">
                          <i className="fas fa-exclamation-circle me-2"></i>
                          {error}
                        </Alert>
                      )}

                      <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-4">
                          <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                            <i className="fas fa-envelope me-2"></i>
                            Email Address
                          </Form.Label>
                          <Form.Control
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your.email@university.edu"
                            className="py-3 border-2"
                            style={{ borderColor: '#87CEEB' }}
                            disabled={isLoading}
                          />
                        </Form.Group>

                        <Button
                          type="submit"
                          className="w-100 py-3 fw-bold border-0 shadow-sm"
                          disabled={isLoading}
                          size="lg"
                          style={{ 
                            background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                            borderRadius: '12px'
                          }}
                        >
                          {isLoading ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Sending Reset Link...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-paper-plane me-2"></i>
                              Send Reset Link
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

export default ForgotPasswordPage;