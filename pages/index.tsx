import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { useRouter } from 'next/router';

const LandingPage: React.FC = () => {
  const router = useRouter();

  return (
    <>
      {/* Include Font Awesome for icons */}
      <link 
        rel="stylesheet" 
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
      />

      <div 
        className="min-vh-100 d-flex align-items-center justify-content-center"
        style={{ 
          background: 'linear-gradient(135deg, #2F4156 0%, #567C8D 100%)'
        }}
      >
        <Container>
          {/* Header Section */}
          <div className="text-center text-white mb-5">
            <div className="mb-4">
              <i 
                className="fas fa-graduation-cap"
                style={{ 
                  fontSize: '4rem', 
                  color: '#C8D9E6'
                }}
              ></i>
            </div>
            
            <h1 
              className="display-4 fw-bold mb-4"
              style={{ 
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              Smart Schedule System
            </h1>
            
            <p 
              className="lead"
              style={{ 
                color: '#C8D9E6',
                fontSize: '1.3rem'
              }}
            >
              Intelligent academic scheduling and coordination platform
            </p>
          </div>

          {/* Action Cards */}
          <Row className="justify-content-center g-4">
            {/* Sign In Card */}
            <Col xs={12} md={6} lg={4}>
              <div 
                className="card h-100 border-0 shadow-lg text-center"
                style={{ 
                  borderRadius: '20px',
                  background: '#F5EFEB'
                }}
              >
                <div className="card-body p-5">
                  <div className="mb-4">
                    <i 
                      className="fas fa-sign-in-alt"
                      style={{ 
                        fontSize: '3rem',
                        color: '#2F4156'
                      }}
                    ></i>
                  </div>
                  <h3 
                    className="fw-bold mb-4"
                    style={{ color: '#2F4156' }}
                  >
                    Sign In
                  </h3>
                  <Button
                    size="lg"
                    className="w-100 fw-bold rounded-pill py-3 border-0"
                    style={{ 
                      background: '#2F4156',
                      color: '#FFFFFF'
                    }}
                    onClick={() => router.push('/auth/login')}
                  >
                    <i className="fas fa-arrow-right me-2"></i>
                    Sign In
                  </Button>
                </div>
              </div>
            </Col>

            {/* Sign Up Card */}
            <Col xs={12} md={6} lg={4}>
              <div 
                className="card h-100 border-0 shadow-lg text-center"
                style={{ 
                  borderRadius: '20px',
                  background: '#F5EFEB'
                }}
              >
                <div className="card-body p-5">
                  <div className="mb-4">
                    <i 
                      className="fas fa-rocket"
                      style={{ 
                        fontSize: '3rem',
                        color: '#2F4156'
                      }}
                    ></i>
                  </div>
                  <h3 
                    className="fw-bold mb-4"
                    style={{ color: '#2F4156' }}
                  >
                    Sign Up
                  </h3>
                  <Button
                    size="lg"
                    className="w-100 fw-bold rounded-pill py-3 border-0"
                    style={{ 
                      background: '#2F4156',
                      color: '#FFFFFF'
                    }}
                    onClick={() => router.push('/auth/signup')}
                  >
                    <i className="fas fa-plus me-2"></i>
                    Sign Up
                  </Button>
                </div>
              </div>
            </Col>
          </Row>

          {/* Footer info */}
          <div className="text-center mt-5 pt-4">
            <div className="d-flex justify-content-center align-items-center flex-wrap gap-4">
              <small className="text-light">
                <i className="fas fa-users me-1"></i>
                Trusted by 10,000+ students
              </small>
              <small className="text-light">
                <i className="fas fa-shield-alt me-1"></i>
                Secure & Reliable
              </small>
              <small className="text-light">
                <i className="fas fa-clock me-1"></i>
                24/7 Support
              </small>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
};

export default LandingPage;