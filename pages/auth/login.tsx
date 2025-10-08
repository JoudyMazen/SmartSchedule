import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const getRoleDashboard = (role: string): string => {
    switch (role) {
      case "scheduling_committee":
      case "committee":
        return "/scheduleCommittee/scheduleCommitteeHomePage";
      case "teaching_load_committee":
        return "/teachingLoadCommittee/teachingLoadCommitteeHomePage";
      case "faculty":
        return "/facultyHomePage";
      case "student":
      default:
        return "/studentHomePage";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!formData.email.trim() || !formData.password) {
      setError('Please enter both email and password');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.toLowerCase().trim(),
          password: formData.password
        })
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        const dashboardPath = getRoleDashboard(data.user.role);
        router.push(dashboardPath);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
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
        className="min-vh-100 d-flex align-items-center justify-content-center py-4"
        style={{ 
          background: 'linear-gradient(135deg, #1e3a5f 0%, #87CEEB 100%)'
        }}
      >
        <Container>
          <Row className="justify-content-center">
            <Col sm={10} md={6} lg={5} xl={4}>
              <div className="text-center text-white mb-4">
                <div className="mb-3">
                  <i 
                    className="fas fa-graduation-cap"
                    style={{ 
                      fontSize: '3rem', 
                      color: 'white'
                    }}
                  ></i>
                </div>
                <h2 className="fw-bold mb-2">Welcome Back</h2>
                <p className="mb-0" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  Sign in to your account
                </p>
              </div>

              <Card className="shadow-lg border-0" style={{ borderRadius: '20px' }}>
                <Card.Header 
                  className="text-white text-center py-4 border-0"
                  style={{ 
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                    borderRadius: '20px 20px 0 0'
                  }}
                >
                  <h4 className="mb-0 fw-bold">
                    <i className="fas fa-sign-in-alt me-2"></i>
                    Sign In
                  </h4>
                </Card.Header>
                
                <Card.Body className="p-4 p-md-5" style={{ background: 'white' }}>
                  {error && (
                    <Alert variant="danger" className="d-flex align-items-center mb-4 border-0">
                      <i className="fas fa-exclamation-triangle me-2"></i>
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
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Enter your email"
                        className="py-3 border-2"
                        style={{ borderRadius: '12px', borderColor: '#87CEEB' }}
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                        <i className="fas fa-lock me-2"></i>
                        Password
                      </Form.Label>
                      <div className="position-relative">
                        <Form.Control
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          value={formData.password}
                          onChange={handleInputChange}
                          placeholder="Enter your password"
                          className="py-3 border-2 pe-5"
                          style={{ borderRadius: '12px', borderColor: '#87CEEB' }}
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
                          Signing In...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-arrow-right me-2"></i>
                          Sign In
                        </>
                      )}
                       
                    </Button>
                   {/* Add this after your password Form.Group */}
                   <div className="text-end mb-3">
                      <a 
                      href="/auth/forgot-password" 
                      className="text-decoration-none"
                      style={{ color: '#1e3a5f', fontSize: '0.9rem' }}
                       >
                        Forgot Password?
                          </a>
                          </div>
                  </Form>

                  <div className="text-center mt-4">
                    <p className="text-muted mb-0">
                      Don't have an account?{' '}
                      <a 
                        href="/auth/signup" 
                        className="text-decoration-none fw-bold"
                        style={{ color: '#1e3a5f' }}
                      >
                        Sign up
                      </a>
                    </p>
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

export default LoginPage;