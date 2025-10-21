import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Badge, Spinner, Alert } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowLeft, FaCalendarAlt, FaChartBar, FaClock, FaGraduationCap, FaFlask, FaBook, FaExclamationTriangle } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';

interface ScheduleSlot {
  course_code?: string;
  course_name?: string;
  section_num?: number;
  time_slot: string;
}

interface ScheduleDay {
  day: string;
  slots: (ScheduleSlot | null)[];
}

interface ScheduleData {
  schedule: ScheduleDay[];
  rawSlots: any[];
}

interface ScheduleViewProps {
  scheduleId: number;
  onBack: () => void;
}

export default function ScheduleView({ scheduleId, onBack }: ScheduleViewProps) {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
  }, [scheduleId]);

  const loadSchedule = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schedules/${scheduleId}/view`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setScheduleData(data);
      } else {
        setError(data.message || 'Failed to load schedule');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSlotColor = (slot: ScheduleSlot | null) => {
    if (!slot || !slot.course_code) return '';
    
    if (slot.course_code.includes('MID')) return 'table-warning';
    if (slot.course_code.includes('IC')) return 'table-success';
    if (slot.course_code.includes('Lab')) return 'table-info';
    if (slot.course_code.includes('T')) return 'table-primary';
    
    return 'table-light';
  };

  const getSlotText = (slot: ScheduleSlot | null) => {
    if (!slot || !slot.course_code) return '';
    
    let text = slot.course_code;
    if (slot.section_num) {
      text += ` (S${slot.section_num})`;
    }
    return text;
  };

  if (loading) {
    return (
      <Container className="py-4">
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-2">Loading schedule...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={onBack}>
            Go Back
          </Button>
        </Alert>
      </Container>
    );
  }

  const timeSlots = ['8-9', '9-10', '10-11', '11-12', '12-1', '1-2', '2-3', '3-4'];

  return (
    <div className="min-vh-100" style={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      <Container className="py-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Row className="mb-4">
            <Col>
              <div className="d-flex justify-content-between align-items-center">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <h2 className="text-white d-flex align-items-center">
                    <FaCalendarAlt className="me-3" />
                    Schedule View - ID: {scheduleId}
                  </h2>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    variant="outline-light" 
                    onClick={onBack}
                    className="d-flex align-items-center fw-bold"
                    style={{ borderRadius: '10px' }}
                  >
                    <FaArrowLeft className="me-2" />
                    Back to Dashboard
                  </Button>
                </motion.div>
              </div>
            </Col>
          </Row>
        </motion.div>

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
                <Card.Header className="text-white border-0" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '20px 20px 0 0'
                }}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    <h5 className="mb-0 d-flex align-items-center">
                      <FaChartBar className="me-2" />
                      Academic Schedule Grid
                    </h5>
                  </motion.div>
                </Card.Header>
                <Card.Body className="p-0">
                  <div className="table-responsive">
                    <Table className="table-bordered mb-0 table-enhanced">
                      <thead className="table-dark">
                        <tr>
                          <th style={{ width: '120px' }} className="d-flex align-items-center">
                            <FaClock className="me-2" />
                            Time
                          </th>
                          {scheduleData?.schedule.map((day, index) => (
                            <th key={index} className="text-center" style={{ minWidth: '150px' }}>
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                              >
                                {day.day}
                              </motion.div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {timeSlots.map((timeSlot, timeIndex) => (
                          <tr key={timeIndex}>
                            <td className="fw-bold bg-light d-flex align-items-center">
                              <FaClock className="me-2 text-primary" />
                              {timeSlot}
                            </td>
                            {scheduleData?.schedule.map((day, dayIndex) => {
                              const slot = day.slots[timeIndex];
                              return (
                                <motion.td 
                                  key={dayIndex} 
                                  className={`text-center ${getSlotColor(slot)}`}
                                  style={{ minHeight: '60px', verticalAlign: 'middle' }}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.6 + timeIndex * 0.1 + dayIndex * 0.05, duration: 0.3 }}
                                  whileHover={{ scale: 1.05 }}
                                >
                                  {slot && slot.course_code ? (
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ delay: 0.8 + timeIndex * 0.1 + dayIndex * 0.05, duration: 0.3 }}
                                    >
                                      <div className="fw-bold">{getSlotText(slot)}</div>
                                      {slot.course_name && (
                                        <small className="text-muted">{slot.course_name}</small>
                                      )}
                                    </motion.div>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </motion.td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          <Row className="mt-4">
            <Col>
              <Card className="border-0 shadow-sm" style={{ 
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '15px'
              }}>
                <Card.Header className="border-0 bg-transparent">
                  <h6 className="mb-0 d-flex align-items-center">
                    <FaExclamationTriangle className="me-2 text-warning" />
                    Legend
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={3}>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8, duration: 0.4 }}
                        className="d-flex align-items-center"
                      >
                        <Badge bg="warning" className="me-2 badge-enhanced">MID</Badge>
                        <span>Midterm/Break</span>
                      </motion.div>
                    </Col>
                    <Col md={3}>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.9, duration: 0.4 }}
                        className="d-flex align-items-center"
                      >
                        <Badge bg="success" className="me-2 badge-enhanced">IC</Badge>
                        <span>Information Center</span>
                      </motion.div>
                    </Col>
                    <Col md={3}>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.0, duration: 0.4 }}
                        className="d-flex align-items-center"
                      >
                        <Badge bg="info" className="me-2 badge-enhanced">
                          <FaFlask className="me-1" />
                          Lab
                        </Badge>
                        <span>Laboratory Session</span>
                      </motion.div>
                    </Col>
                    <Col md={3}>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.1, duration: 0.4 }}
                        className="d-flex align-items-center"
                      >
                        <Badge bg="primary" className="me-2 badge-enhanced">
                          <FaBook className="me-1" />
                          T
                        </Badge>
                        <span>Tutorial Session</span>
                      </motion.div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <Row className="mt-4">
            <Col>
              <Card className="border-0 shadow-sm" style={{ 
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '15px'
              }}>
                <Card.Header className="border-0 bg-transparent">
                  <h6 className="mb-0 d-flex align-items-center">
                    <FaChartBar className="me-2 text-primary" />
                    Schedule Statistics
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4}>
                      <motion.div 
                        className="text-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.9, duration: 0.4 }}
                      >
                        <h4 className="text-primary">
                          {scheduleData?.rawSlots.filter(slot => slot.course_code).length || 0}
                        </h4>
                        <p className="text-muted d-flex align-items-center justify-content-center">
                          <FaGraduationCap className="me-2" />
                          Total Classes
                        </p>
                      </motion.div>
                    </Col>
                    <Col md={4}>
                      <motion.div 
                        className="text-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1.0, duration: 0.4 }}
                      >
                        <h4 className="text-success">
                          {scheduleData?.rawSlots.filter(slot => slot.course_code?.includes('Lab')).length || 0}
                        </h4>
                        <p className="text-muted d-flex align-items-center justify-content-center">
                          <FaFlask className="me-2" />
                          Lab Sessions
                        </p>
                      </motion.div>
                    </Col>
                    <Col md={4}>
                      <motion.div 
                        className="text-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1.1, duration: 0.4 }}
                      >
                        <h4 className="text-info">
                          {scheduleData?.rawSlots.filter(slot => slot.course_code?.includes('T')).length || 0}
                        </h4>
                        <p className="text-muted d-flex align-items-center justify-content-center">
                          <FaBook className="me-2" />
                          Tutorial Sessions
                        </p>
                      </motion.div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </motion.div>
      </Container>
    </div>
  );
}
