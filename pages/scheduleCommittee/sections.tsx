import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Table, Button, Alert, Modal, Spinner, Badge } from 'react-bootstrap';
import Layout from '../../components/Layout';
import 'bootstrap-icons/font/bootstrap-icons.css';

interface Course {
  course_code: string;
  course_name: string;
  level: number;
}

interface Section {
  section_id: number;
  section_number: number;
  course_code: string;
  capacity: number;
  activity_type: string;
}

const SectionManagementPage: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = useState<number>(3);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger' | 'warning', message: string} | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [capacity, setCapacity] = useState(25);

  const levels = [3, 4, 5, 6, 7, 8];

  useEffect(() => {
    fetchCourses();
  }, [selectedLevel]);

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/data/courses?level=${selectedLevel}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.courses)) {
        setCourses(data.courses);
        fetchAllSections(data.courses.map((c: Course) => c.course_code));
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      setAlert({type: 'danger', message: 'Failed to load courses'});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllSections = async (courseCodes: string[]) => {
    try {
      const response = await fetch(`/api/scheduleCommittee/sections?level=${selectedLevel}&course_codes=${courseCodes.join(',')}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.sections)) {
        setSections(data.sections);
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  const handleEditSection = (section: Section) => {
    setEditingSection(section);
    setCapacity(section.capacity);
    setShowModal(true);
  };

  const handleUpdateCapacity = async () => {
    if (!editingSection) return;

    try {
      const response = await fetch(`/api/scheduleCommittee/sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: editingSection.section_id,
          capacity: capacity
        })
      });

      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: 'Capacity updated successfully!'});
        fetchCourses();
        setShowModal(false);
        setEditingSection(null);
      } else {
        setAlert({type: 'danger', message: data.error || 'Failed to update'});
      }
    } catch (error) {
      setAlert({type: 'danger', message: 'Network error'});
    }
  };

  const getSectionsForCourse = (courseCode: string) => {
    return sections.filter(s => s.course_code === courseCode);
  };

  const getTotalCapacityForCourse = (courseCode: string) => {
    const courseSections = getSectionsForCourse(courseCode);
    return courseSections.reduce((sum, s) => sum + s.capacity, 0);
  };

  return (
    <Layout>
      <style>{`
        .course-card {
          transition: transform 0.2s, box-shadow 0.2s;
          border-left: 4px solid #1e3a5f;
        }
        .course-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        }
        .section-row:hover {
          background-color: #e6f4ff;
        }
      `}</style>

      <div style={{ background: '#ececec', minHeight: '100vh' }}>
        <Container className="py-4">
          <div className="mb-4">
            <h2 className="fw-bold mb-2" style={{ color: '#1e3a5f' }}>
              Section Management
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              Manage course sections and student capacity
            </p>
          </div>

          {alert && (
            <Alert variant={alert.type} onClose={() => setAlert(null)} dismissible className="border-0 shadow-sm">
              {alert.message}
            </Alert>
          )}

          <Card className="mb-4 border-0 shadow-sm" style={{ background: 'white' }}>
            <Card.Body>
              <Row className="align-items-center">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                      <i className="bi bi-filter me-2"></i>
                      Select Level
                    </Form.Label>
                    <Form.Select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
                      className="border-2"
                      style={{ borderColor: '#87CEEB' }}
                      size="lg"
                    >
                      {levels.map(level => (
                        <option key={level} value={level}>Level {level}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6} className="text-end">
                  <span 
                    className="me-3 px-3 py-2 rounded"
                    style={{ 
                      background: '#e6f4ff',
                      color: '#1e3a5f',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}
                  >
                    <i className="bi bi-book me-1"></i>
                    {courses.length} Courses
                  </span>
                  <span 
                    className="px-3 py-2 rounded"
                    style={{ 
                      background: '#b0c4d4',
                      color: '#1e3a5f',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}
                  >
                    <i className="bi bi-grid-3x3 me-1"></i>
                    {sections.length} Sections
                  </span>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {isLoading && (
            <div className="text-center p-5">
              <Spinner animation="border" style={{ color: '#1e3a5f' }} />
              <p className="mt-3" style={{ color: '#1e3a5f' }}>Loading...</p>
            </div>
          )}

          {!isLoading && courses.map((course) => {
            const courseSections = getSectionsForCourse(course.course_code);
            const totalCapacity = getTotalCapacityForCourse(course.course_code);

            return (
              <Card key={course.course_code} className="mb-4 course-card border-0 shadow-sm">
                <Card.Header 
                  className="py-3"
                  style={{ 
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                    color: 'white'
                  }}
                >
                  <Row className="align-items-center">
                    <Col>
                      <h5 className="mb-0 fw-semibold">
                        {course.course_code} - {course.course_name}
                      </h5>
                    </Col>
                    <Col xs="auto">
                      <span 
                        className="me-2 px-3 py-1 rounded"
                        style={{ 
                          background: 'white',
                          color: '#1e3a5f',
                          fontWeight: '600',
                          fontSize: '0.85rem'
                        }}
                      >
                        Total Capacity: {totalCapacity} students
                      </span>
                      <span 
                        className="px-3 py-1 rounded"
                        style={{ 
                          background: '#87CEEB',
                          color: '#1e3a5f',
                          fontWeight: '600',
                          fontSize: '0.85rem'
                        }}
                      >
                        {courseSections.length} sections
                      </span>
                    </Col>
                  </Row>
                </Card.Header>
                <Card.Body className="p-0">
                  {courseSections.length === 0 ? (
                    <div className="text-center p-5" style={{ color: '#5a7a99' }}>
                      <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                      <p className="mt-3 mb-0">No sections available for this course</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <Table hover responsive className="mb-0" style={{ minWidth: '600px' }}>
                        <thead>
                          <tr style={{ background: '#87CEEB' }}>
                            <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none' }}>
                              Section Number
                            </th>
                            <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none', borderLeft: '1px solid #dee2e6' }}>
                              Activity Type
                            </th>
                            <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none', borderLeft: '1px solid #dee2e6' }}>
                              Capacity
                            </th>
                            <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none', borderLeft: '1px solid #dee2e6' }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseSections.map((section, idx) => (
                            <tr key={section.section_id} className="section-row">
                              <td 
                                className="fw-semibold align-middle"
                                style={{ 
                                  color: '#1e3a5f',
                                  padding: '12px',
                                  background: 'white',
                                  border: 'none',
                                  borderTop: idx > 0 ? '1px solid #dee2e6' : 'none'
                                }}
                              >
                                {section.section_number}
                              </td>
                              <td 
                                className="align-middle"
                                style={{ 
                                  padding: '12px',
                                  background: 'white',
                                  border: 'none',
                                  borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                                  borderLeft: '1px solid #dee2e6'
                                }}
                              >
                                <span style={{
                                  background: '#e6f4ff',
                                  color: '#1e3a5f',
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '0.85rem',
                                  fontWeight: '500'
                                }}>
                                  {section.activity_type}
                                </span>
                              </td>
                              <td 
                                className="fw-bold align-middle"
                                style={{ 
                                  color: '#1e3a5f',
                                  padding: '12px',
                                  background: 'white',
                                  border: 'none',
                                  borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                                  borderLeft: '1px solid #dee2e6'
                                }}
                              >
                                {section.capacity}
                              </td>
                              <td 
                                className="align-middle"
                                style={{ 
                                  padding: '12px',
                                  background: 'white',
                                  border: 'none',
                                  borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                                  borderLeft: '1px solid #dee2e6'
                                }}
                              >
                                <Button
                                  size="sm"
                                  className="border-0"
                                  style={{ 
                                    background: '#87CEEB',
                                    color: '#1e3a5f',
                                    padding: '6px 16px'
                                  }}
                                  onClick={() => handleEditSection(section)}
                                >
                                  <i className="bi bi-pencil-square me-1"></i>
                                  Edit Capacity
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </Card.Body>
              </Card>
            );
          })}

          <Modal show={showModal} onHide={() => setShowModal(false)} centered>
            <Modal.Header 
              closeButton 
              className="border-0"
              style={{ 
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                color: 'white'
              }}
            >
              <Modal.Title className="fw-semibold">
                <i className="bi bi-pencil-square me-2"></i>
                Edit Section Capacity
              </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ background: 'white' }}>
              {editingSection && (
                <>
                  <div className="mb-3">
                    <strong style={{ color: '#1e3a5f' }}>Course:</strong>{' '}
                    <span style={{ color: '#5a7a99' }}>{editingSection.course_code}</span>
                  </div>
                  <div className="mb-3">
                    <strong style={{ color: '#1e3a5f' }}>Section:</strong>{' '}
                    <span style={{ color: '#5a7a99' }}>{editingSection.section_number}</span>
                  </div>
                  <div className="mb-3">
                    <strong style={{ color: '#1e3a5f' }}>Activity Type:</strong>{' '}
                    <span style={{ color: '#5a7a99' }}>{editingSection.activity_type}</span>
                  </div>
                  <Form.Group>
                    <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                      Section Capacity
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      max="100"
                      value={capacity}
                      onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                      className="border-2"
                      style={{ borderColor: '#87CEEB' }}
                    />
                    <Form.Text className="text-muted">
                      Default: 25 students per section. Set the maximum capacity for this section.
                    </Form.Text>
                  </Form.Group>
                </>
              )}
            </Modal.Body>
            <Modal.Footer style={{ background: 'white', borderTop: '1px solid #dee2e6' }}>
              <Button 
                className="border-0"
                style={{ background: '#b0c4d4', color: '#1e3a5f' }}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="border-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }}
                onClick={handleUpdateCapacity}
              >
                <i className="bi bi-check-lg me-1"></i>
                Update Capacity
              </Button>
            </Modal.Footer>
          </Modal>
        </Container>
      </div>
    </Layout>
  );
};

export default SectionManagementPage;