import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Navbar, Nav, Dropdown } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUser, FaCog, FaCalendarAlt, FaChartBar, FaSignOutAlt, FaRobot, FaEye, FaGraduationCap, FaChalkboardTeacher } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';
import ScheduleView from '../components/ScheduleView';

interface User {
  user_id: number;
  name: string;
  email: string;
  role: string;
}

interface Schedule {
  schedule_id: number;
  level_num: number;
  group_num: number;
  status: string;
  created_at?: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          user_id: payload.user_id,
          name: payload.name || 'User',
          email: payload.email,
          role: payload.role
        });
        loadSchedules();
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
  }, []);

  const loadSchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSchedules(data.schedules);
      }
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  };

  const generateAISchedule = async (level: number) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          level_num: level,
          group_num: 1,
          generate_ai: true
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: `AI schedule generated for Level ${level}` });
        loadSchedules();
      } else {
        setMessage({ type: 'danger', text: data.message || 'Failed to generate schedule' });
      }
    } catch (error) {
      setMessage({ type: 'danger', text: 'Failed to generate schedule' });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setSchedules([]);
  };

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  if (viewingSchedule) {
    return <ScheduleView scheduleId={viewingSchedule} onBack={() => setViewingSchedule(null)} />;
  }

  return (
    <div className="min-vh-100" style={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Navbar bg="dark" variant="dark" expand="lg" className="shadow-lg">
          <Container>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Navbar.Brand className="d-flex align-items-center">
                <FaCalendarAlt className="me-2 text-primary" />
                <span className="fw-bold">Smart Schedule System</span>
              </Navbar.Brand>
            </motion.div>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                <Nav.Link href="#home" className="d-flex align-items-center">
                  <FaChartBar className="me-1" />
                  Dashboard
                </Nav.Link>
                {user.role === 'scheduling_committee' && (
                  <Nav.Link href="#schedules" className="d-flex align-items-center">
                    <FaCog className="me-1" />
                    Schedules
                  </Nav.Link>
                )}
              </Nav>
              <Dropdown>
                <Dropdown.Toggle variant="outline-light" id="dropdown-basic" className="d-flex align-items-center">
                  <FaUser className="me-2" />
                  {user.name} ({user.role.replace('_', ' ').toUpperCase()})
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={logout} className="d-flex align-items-center">
                    <FaSignOutAlt className="me-2" />
                    Logout
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </motion.div>

      <Container className="py-4">
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.3 }}
            >
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="shadow">
                {message.text}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <Row>
            <Col>
              <Card className="shadow-lg border-0" style={{ 
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px'
              }}>
                <Card.Header className="bg-gradient text-white border-0" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '20px 20px 0 0'
                }}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    <h4 className="mb-0 d-flex align-items-center">
                      <FaUser className="me-2" />
                      Welcome, {user.name}
                    </h4>
                    <small className="opacity-75">
                      Role: {user.role.replace('_', ' ').toUpperCase()}
                    </small>
                  </motion.div>
                </Card.Header>
                <Card.Body className="p-4">
                  {user.role === 'scheduling_committee' ? (
                    <SchedulingCommitteeDashboard 
                      schedules={schedules}
                      onGenerateAI={generateAISchedule}
                      loading={loading}
                      onViewSchedule={setViewingSchedule}
                    />
                  ) : (
                    <StudentFacultyDashboard schedules={schedules} onViewSchedule={setViewingSchedule} />
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </motion.div>
      </Container>
    </div>
  );
}

function SchedulingCommitteeDashboard({ schedules, onGenerateAI, loading, onViewSchedule }: {
  schedules: Schedule[];
  onGenerateAI: (level: number) => void;
  loading: boolean;
  onViewSchedule: (id: number) => void;
}) {
  return (
    <div>
      <h5 className="mb-4">Schedule Management</h5>
      
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header>
              <h6 className="mb-0">Generate AI Schedules</h6>
            </Card.Header>
            <Card.Body>
              <p className="text-muted">Generate schedules for each level using AI</p>
              <Row>
                {[3, 4, 5, 6, 7, 8].map(level => (
                  <Col key={level} md={2} className="mb-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => onGenerateAI(level)}
                      disabled={loading}
                      className="w-100"
                    >
                      Level {level}
                    </Button>
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h6 className="mb-0">All Schedules</h6>
            </Card.Header>
            <Card.Body>
              {schedules.length === 0 ? (
                <p className="text-muted">No schedules created yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Schedule ID</th>
                        <th>Level</th>
                        <th>Group</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map(schedule => (
                        <tr key={schedule.schedule_id}>
                          <td>{schedule.schedule_id}</td>
                          <td>Level {schedule.level_num}</td>
                          <td>Group {schedule.group_num}</td>
                          <td>
                            <span className={`badge ${
                              schedule.status === 'published' ? 'bg-success' : 
                              schedule.status === 'draft' ? 'bg-warning' : 'bg-secondary'
                            }`}>
                              {schedule.status}
                            </span>
                          </td>
                          <td>{schedule.created_at ? new Date(schedule.created_at).toLocaleDateString() : 'N/A'}</td>
                          <td>
                            <Button 
                              variant="outline-primary" 
                              size="sm"
                              onClick={() => onViewSchedule(schedule.schedule_id)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function StudentFacultyDashboard({ schedules, onViewSchedule }: { schedules: Schedule[]; onViewSchedule: (id: number) => void }) {
  return (
    <div>
      <h5 className="mb-4">Your Dashboard</h5>
      <p className="text-muted">View your schedules and academic information.</p>
      
      <Row>
        <Col md={6}>
          <Card>
            <Card.Header>
              <h6 className="mb-0">Available Schedules</h6>
            </Card.Header>
            <Card.Body>
              {schedules.length === 0 ? (
                <p className="text-muted">No schedules available yet.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {schedules.map(schedule => (
                    <li key={schedule.schedule_id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        Level {schedule.level_num} - Group {schedule.group_num}
                        <br />
                        <small className="text-muted">ID: {schedule.schedule_id}</small>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge ${
                          schedule.status === 'published' ? 'bg-success' : 'bg-warning'
                        }`}>
                          {schedule.status}
                        </span>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => onViewSchedule(schedule.schedule_id)}
                        >
                          View
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <Card.Header>
              <h6 className="mb-0">Quick Actions</h6>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="outline-primary">View Schedule</Button>
                <Button variant="outline-secondary">Submit Feedback</Button>
                <Button variant="outline-info">View Notifications</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'student'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const body = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        onLogin(data.user);
        setMessage({ type: 'success', text: isLogin ? 'Login successful!' : 'Account created successfully!' });
      } else {
        setMessage({ type: 'danger', text: data.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'danger', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center" style={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={4}>
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="shadow-lg border-0" style={{ 
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)'
              }}>
                <Card.Header className="text-center border-0" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '20px 20px 0 0',
                  padding: '2rem 1rem'
                }}>
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <FaCalendarAlt size={48} className="text-white mb-3" />
                    <h4 className="mb-0 text-white fw-bold">Smart Schedule System</h4>
                    <small className="text-white opacity-75">Academic Management Platform</small>
                  </motion.div>
                </Card.Header>
                <Card.Body className="p-4">
                  <AnimatePresence mode="wait">
                    {message && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="border-0 shadow-sm">
                          {message.text}
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div 
                    className="text-center mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    <div className="btn-group w-100" role="group">
                      <Button
                        variant={isLogin ? 'primary' : 'outline-primary'}
                        onClick={() => setIsLogin(true)}
                        className="rounded-start"
                        style={{ borderRadius: '10px 0 0 10px' }}
                      >
                        <FaUser className="me-2" />
                        Login
                      </Button>
                      <Button
                        variant={!isLogin ? 'primary' : 'outline-primary'}
                        onClick={() => setIsLogin(false)}
                        className="rounded-end"
                        style={{ borderRadius: '0 10px 10px 0' }}
                      >
                        <FaUser className="me-2" />
                        Sign Up
                      </Button>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    <Form onSubmit={handleSubmit}>
                      {!isLogin && (
                        <>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Full Name</Form.Label>
                            <Form.Control
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              required={!isLogin}
                              className="border-2"
                              style={{ borderRadius: '10px' }}
                            />
                          </Form.Group>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Phone Number</Form.Label>
                            <Form.Control
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              className="border-2"
                              style={{ borderRadius: '10px' }}
                            />
                          </Form.Group>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Role</Form.Label>
                            <Form.Select
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                              className="border-2"
                              style={{ borderRadius: '10px' }}
                            >
                              <option value="student">
                                <FaGraduationCap className="me-2" />
                                Student
                              </option>
                              <option value="faculty">
                                <FaChalkboardTeacher className="me-2" />
                                Faculty
                              </option>
                              <option value="scheduling_committee">
                                <FaCog className="me-2" />
                                Scheduling Committee
                              </option>
                              <option value="teaching_load_committee">
                                <FaCog className="me-2" />
                                Teaching Load Committee
                              </option>
                            </Form.Select>
                          </Form.Group>
                        </>
                      )}

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Email</Form.Label>
                        <Form.Control
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          className="border-2"
                          style={{ borderRadius: '10px' }}
                        />
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="fw-bold">Password</Form.Label>
                        <Form.Control
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                          className="border-2"
                          style={{ borderRadius: '10px' }}
                        />
                      </Form.Group>

                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          type="submit"
                          variant="primary"
                          className="w-100 fw-bold py-3"
                          disabled={loading}
                          style={{ 
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none'
                          }}
                        >
                          {loading ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                              ⏳ Processing...
                            </motion.div>
                          ) : (
                            <>
                              {isLogin ? (
                                <>
                                  <FaUser className="me-2" />
                                  Login
                                </>
                              ) : (
                                <>
                                  <FaUser className="me-2" />
                                  Sign Up
                                </>
                              )}
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </Form>
                  </motion.div>
                </Card.Body>
              </Card>
            </motion.div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
