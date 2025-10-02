import React, { useState } from "react";
import { useRouter } from "next/router";
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from "react-bootstrap";

// Fix for FormControl type issue
type FormControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: "student" | "faculty" | "committee";
}

interface Errors {
  [key: string]: string;
}

const SignupPage: React.FC = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "student",
  });

  const [errors, setErrors] = useState<Errors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, ''); // remove spaces/dashes
    const phoneRegex = /^05[0-9]\d{7}$/; // 050-059 + 7 digits
    return phoneRegex.test(cleaned);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkPasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  // Fixed onChange handler with proper type
  const handleInputChange = (e: React.ChangeEvent<FormControlElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }

    // Check password strength in real-time
    if (name === "password") {
      setPasswordStrength(checkPasswordStrength(value));
    }

    // Format phone number as user types
    if (name === "phone") {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 3) {
        setFormData(prev => ({ ...prev, phone: cleaned }));
      } else if (cleaned.length <= 6) {
        setFormData(prev => ({ ...prev, phone: `${cleaned.slice(0, 3)}-${cleaned.slice(3)}` }));
      } else {
        setFormData(prev => ({ ...prev, phone: `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}` }));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Errors = {};

    // Required field validation
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = "Please enter a valid UAE phone number (e.g., 0509991234)";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    } else if (passwordStrength < 3) {
      newErrors.password = "Password is too weak. Include uppercase, lowercase, numbers, and special characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getRoleDashboard = (role: string): string => {
    switch (role) {
      case "committee":
        return "/scheduleCommittee/scheduleCommitteHomePage";
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

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.toLowerCase().trim(),
          phone: formData.phone.replace(/\D/g, ''), // remove formatting
          password: formData.password,
          role: formData.role === "committee" ? "scheduling_committee" : formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP error! status: ${res.status}`);
      }

      if (data.success) {
        // Store authentication data
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        // Redirect to role-specific dashboard
        const dashboardPath = getRoleDashboard(formData.role);
        router.push(dashboardPath);
      } else {
        setErrors({ general: data.message || "Registration failed. Please try again." });
      }
    } catch (error) {
      console.error("Registration error:", error);
      setErrors({ 
        general: error instanceof Error ? error.message : "Network error. Please try again." 
      });
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
        <small className="text-muted d-block mt-1">
          Include uppercase, lowercase, numbers, and special characters
        </small>
      </div>
    );
  };

  const RoleOption: React.FC<{
    value: string;
    icon: string;
    label: string;
    description: string;
    selected: boolean;
    onSelect: (value: string) => void;
  }> = ({ value, icon, label, description, selected, onSelect }) => (
    <div 
      className={`card cursor-pointer h-100 ${selected ? 'border-3' : 'border-light'}`}
      onClick={() => onSelect(value)}
      style={{ 
        transition: 'all 0.3s ease',
        borderColor: selected ? '#2F4156' : undefined,
        backgroundColor: selected ? '#F5EFEB' : 'white',
        cursor: 'pointer'
      }}
    >
      <div className="card-body text-center">
        <div className="mb-3" style={{ color: selected ? '#2F4156' : '#6c757d' }}>
          <i className={icon} style={{ fontSize: '2rem' }}></i>
        </div>
        <h6 className="card-title" style={{ color: selected ? '#2F4156' : '#212529' }}>
          {label}
        </h6>
        <p className="card-text small text-muted">{description}</p>
        {selected && (
          <div style={{ color: '#2F4156' }}>
            <i className="fas fa-check"></i>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Include Font Awesome for icons */}
      <link 
        rel="stylesheet" 
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
      />

      <div 
        className="min-vh-100 d-flex align-items-center justify-content-center py-4"
        style={{ 
          background: 'linear-gradient(135deg, #2F4156 0%, #567C8D 100%)'
        }}
      >
        <Container>
          <Row className="justify-content-center">
            <Col md={8} lg={6} xl={5}>
              <Card className="shadow-lg border-0" style={{ borderRadius: '20px' }}>
                <Card.Header 
                  className="text-white text-center py-4 border-0"
                  style={{ 
                    background: '#2F4156',
                    borderRadius: '20px 20px 0 0'
                  }}
                >
                  <h2 className="mb-0 fw-bold">Create Your Account</h2>
                  <p className="mb-0 opacity-75">Join Smart Schedule System</p>
                </Card.Header>
                
                <Card.Body className="p-4 p-md-5" style={{ background: '#F5EFEB' }}>
                  {errors.general && (
                    <Alert variant="danger" className="d-flex align-items-center">
                      <i className="fas fa-times me-2"></i>
                      {errors.general}
                    </Alert>
                  )}

                  <Form onSubmit={handleSubmit}>
                    {/* Role Selection */}
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold mb-3" style={{ color: '#2F4156' }}>
                        Select Your Role *
                      </Form.Label>
                      <Row className="g-3">
                        <Col md={4}>
                          <RoleOption
                            value="student"
                            icon="fas fa-graduation-cap"
                            label="Student"
                            description="Access courses and schedules"
                            selected={formData.role === "student"}
                            onSelect={(value) => setFormData(prev => ({ ...prev, role: value as any }))}
                          />
                        </Col>
                        <Col md={4}>
                          <RoleOption
                            value="faculty"
                            icon="fas fa-chalkboard-teacher"
                            label="Faculty"
                            description="Manage courses and schedules"
                            selected={formData.role === "faculty"}
                            onSelect={(value) => setFormData(prev => ({ ...prev, role: value as any }))}
                          />
                        </Col>
                        <Col md={4}>
                          <RoleOption
                            value="committee"
                            icon="fas fa-cog"
                            label="Committee"
                            description="Administer system settings"
                            selected={formData.role === "committee"}
                            onSelect={(value) => setFormData(prev => ({ ...prev, role: value as any }))}
                          />
                        </Col>
                      </Row>
                    </Form.Group>

                    {/* Name Fields */}
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold" style={{ color: '#2F4156' }}>
                            <i className="fas fa-user me-2"></i>
                            First Name *
                          </Form.Label>
                          <Form.Control
                            name="firstName"
                            type="text"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            isInvalid={!!errors.firstName}
                            placeholder="Enter your first name"
                            className="py-3"
                          />
                          <Form.Control.Feedback type="invalid">
                            {errors.firstName}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold" style={{ color: '#2F4156' }}>
                            <i className="fas fa-user me-2"></i>
                            Last Name *
                          </Form.Label>
                          <Form.Control
                            name="lastName"
                            type="text"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            isInvalid={!!errors.lastName}
                            placeholder="Enter your last name"
                            className="py-3"
                          />
                          <Form.Control.Feedback type="invalid">
                            {errors.lastName}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Email */}
                    <Form.Group className="mt-3">
                      <Form.Label className="fw-bold" style={{ color: '#2F4156' }}>
                        <i className="fas fa-envelope me-2"></i>
                        Email Address *
                      </Form.Label>
                      <Form.Control
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        isInvalid={!!errors.email}
                        placeholder="your.email@university.edu"
                        className="py-3"
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.email}
                      </Form.Control.Feedback>
                    </Form.Group>

                    {/* Phone */}
                    <Form.Group className="mt-3">
                      <Form.Label className="fw-bold" style={{ color: '#2F4156' }}>
                        <i className="fas fa-phone me-2"></i>
                        Phone Number 
                      </Form.Label>
                      <Form.Control
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        isInvalid={!!errors.phone}
                        placeholder="050-999-1234"
                        className="py-3"
                      />
                      <Form.Text className="text-muted">
                        Format: 0509991234 or 050-999-1234
                      </Form.Text>
                      <Form.Control.Feedback type="invalid">
                        {errors.phone}
                      </Form.Control.Feedback>
                    </Form.Group>

                    {/* Password */}
                    <Form.Group className="mt-3">
                      <Form.Label className="fw-bold" style={{ color: '#2F4156' }}>
                        <i className="fas fa-lock me-2"></i>
                        Password *
                      </Form.Label>
                      <Form.Control
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        isInvalid={!!errors.password}
                        placeholder="Create a strong password"
                        className="py-3"
                      />
                      {formData.password && <PasswordStrengthIndicator />}
                      <Form.Control.Feedback type="invalid">
                        {errors.password}
                      </Form.Control.Feedback>
                    </Form.Group>

                    {/* Confirm Password */}
                    <Form.Group className="mt-3">
                      <Form.Label className="fw-bold" style={{ color: '#2F4156' }}>
                        <i className="fas fa-lock me-2"></i>
                        Confirm Password *
                      </Form.Label>
                      <Form.Control
                        name="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        isInvalid={!!errors.confirmPassword}
                        placeholder="Confirm your password"
                        className="py-3"
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.confirmPassword}
                      </Form.Control.Feedback>
                    </Form.Group>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className="w-100 py-3 mt-4 fw-bold border-0"
                      disabled={isLoading}
                      size="lg"
                      style={{ 
                        background: '#2F4156',
                        borderRadius: '12px'
                      }}
                    >
                      {isLoading ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Creating Account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </Form>

                  {/* Login Link */}
                  <div className="text-center mt-4">
                    <p className="text-muted">
                      Already have an account?{" "}
                      <a 
                        href="/auth/login" 
                        className="text-decoration-none fw-bold"
                        style={{ color: '#2F4156' }}
                      >
                        Sign in here
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

export default SignupPage;