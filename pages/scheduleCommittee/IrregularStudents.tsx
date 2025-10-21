import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Modal, Badge } from 'react-bootstrap';

interface IrregularStudent {
  student_id: number;
  name: string;
  university_id: string;
  level: number;
  remaining_courses: string[];
  created_at?: string;
}

interface Course {
  course_code: string;
  course_name: string;
  level: number;
  is_elective: boolean;
  credits: number;
  lecture_hours: number;
  tutorial_hours: number;
  lab_hours: number;
}

interface FormData {
  name: string;
  university_id: string;
  level: number;
  remaining_courses: string[];
}

const IrregularStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<IrregularStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'warning'; message: string } | null>(null);
  const [filterLevel, setFilterLevel] = useState<number | 'all'>('all');

  // Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    university_id: '',
    level: 6,
    remaining_courses: []
  });
  const [errors, setErrors] = useState<any>({});

  // Courses
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [coursesByLevel, setCoursesByLevel] = useState<{ [key: string]: Course[] }>({});

  const levels = [6, 7, 8];

  useEffect(() => {
    void loadCourses();
    void loadIrregularStudents();
  }, []);

  const loadCourses = async () => {
    // SWE BSc Study Plan Courses - Hardcoded from the official study plan
    const allCoursesData: Course[] = [
      // Level 3 (Semester 3)
      { course_code: 'PHYS103', course_name: 'General Physics I', level: 3, is_elective: false, credits: 4, lecture_hours: 3, tutorial_hours: 0, lab_hours: 1 },
      { course_code: 'CSC111', course_name: 'Computer Programming I', level: 3, is_elective: false, credits: 4, lecture_hours: 3, tutorial_hours: 0, lab_hours: 1 },
      { course_code: 'MATH106', course_name: 'Integral Calculus', level: 3, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'MATH151', course_name: 'Discrete Mathematics', level: 3, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      
      // Level 4 (Semester 4)
      { course_code: 'SWE211', course_name: 'Introduction to Software Engineering', level: 4, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CSC113', course_name: 'Computer Programming II', level: 4, is_elective: false, credits: 4, lecture_hours: 3, tutorial_hours: 0, lab_hours: 1 },
      { course_code: 'PHYS104', course_name: 'General Physics II', level: 4, is_elective: false, credits: 4, lecture_hours: 3, tutorial_hours: 0, lab_hours: 1 },
      { course_code: 'MATH244', course_name: 'Linear Algebra', level: 4, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CEN303', course_name: 'Computer Communications and Networks', level: 4, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      
      // Level 5 (Semester 5)
      { course_code: 'CSC220', course_name: 'Computer Organization', level: 5, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CSC212', course_name: 'Data Structures', level: 5, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE314', course_name: 'Software Security Engineering', level: 5, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE312', course_name: 'Software Requirements Engineering', level: 5, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      
      // Level 6 (Semester 6)
      { course_code: 'CSC227', course_name: 'Operation Systems', level: 6, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'IS230', course_name: 'Introduction to Database Systems', level: 6, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE321', course_name: 'Software Design and Architecture', level: 6, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE381', course_name: 'Web Application Development', level: 6, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE333', course_name: 'Software Quality Assurance', level: 6, is_elective: false, credits: 2, lecture_hours: 2, tutorial_hours: 0, lab_hours: 0 },
      
      // Level 7 (Semester 7)
      { course_code: 'IC107', course_name: 'Professional Ethics', level: 7, is_elective: false, credits: 2, lecture_hours: 2, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE482', course_name: 'Human-Computer Interaction', level: 7, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE434', course_name: 'Software Testing & Validation', level: 7, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE444', course_name: 'Software Construction Laboratory', level: 7, is_elective: false, credits: 2, lecture_hours: 0, tutorial_hours: 0, lab_hours: 2 },
      { course_code: 'SWE496', course_name: 'Graduation Project I', level: 7, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE477', course_name: 'Software Engineering Code of Ethics & Professional Practice', level: 7, is_elective: false, credits: 2, lecture_hours: 2, tutorial_hours: 0, lab_hours: 0 },
      
      // Level 8 (Semester 8)
      { course_code: 'SWE455', course_name: 'Software Maintenance & Evolution', level: 8, is_elective: false, credits: 2, lecture_hours: 2, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE466', course_name: 'Software Project Management', level: 8, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE497', course_name: 'Graduation Project II', level: 8, is_elective: false, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'IC108', course_name: 'Contemporary Issues', level: 8, is_elective: false, credits: 2, lecture_hours: 2, tutorial_hours: 0, lab_hours: 0 },
      
      // Department Electives
      { course_code: 'SWE481', course_name: 'Advanced Web Applications Engineering', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE483', course_name: 'Mobile Application Development', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE484', course_name: 'Multimedia Computing', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE485', course_name: 'Selected Topics in Software Engineering', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE486', course_name: 'Cloud Computing and Big Data', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'SWE488', course_name: 'Complex System Engineering', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CEN316', course_name: 'Computer Architecture', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CEN445', course_name: 'Network Protocols & Algorithms', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CEN318', course_name: 'Embedded Systems Design', level: 0, is_elective: true, credits: 5, lecture_hours: 4, tutorial_hours: 0, lab_hours: 1 },
      { course_code: 'CSC215', course_name: 'Procedural Language', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CSC311', course_name: 'Algorithms', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CSC361', course_name: 'Artificial Intelligence', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CSC476', course_name: 'Computer Graphics', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'CSC478', course_name: 'Digital Image Processing', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'IS385', course_name: 'Enterprise Resource Planning Systems', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'IS485', course_name: 'ERP Systems Lab', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      
      // Math and Statistics Electives
      { course_code: 'MATH200', course_name: 'Differential and Integral Calculus', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'MATH254', course_name: 'Numerical Analysis', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'OPER122', course_name: 'Introduction to Operations Research', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      
      // Science Electives
      { course_code: 'BIOL145', course_name: 'Biology', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'BCH101', course_name: 'General Biochemistry', level: 0, is_elective: true, credits: 4, lecture_hours: 3, tutorial_hours: 0, lab_hours: 1 },
      { course_code: 'MIC140', course_name: 'General Microbiology', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'GPH201', course_name: 'Principles of Geophysics', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
      { course_code: 'PHYS201', course_name: 'Mathematical Physics I', level: 0, is_elective: true, credits: 3, lecture_hours: 3, tutorial_hours: 0, lab_hours: 0 },
    ];
    
    setAllCourses(allCoursesData);
    
    const grouped: {[key: string]: Course[]} = {};
    for (let level = 3; level <= 8; level++) {
      grouped[`level${level}`] = allCoursesData.filter(c => c.level === level && !c.is_elective);
    }
    grouped['electives'] = allCoursesData.filter(c => c.is_elective);
    setCoursesByLevel(grouped);
    console.log('Courses loaded:', grouped);
  };

  const loadIrregularStudents = async () => {
    setIsLoading(true);
    try {
      const url = `/api/scheduleCommittee/irregular-students${filterLevel === 'all' ? '' : `?level=${filterLevel}`}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
      setStudents(data.students || []);
    } catch (error: any) {
      setAlert({type: 'danger', message: `Failed to load irregular students: ${error.message || error}`});
    } finally {
      setIsLoading(false);
    }
  };

  const createIrregularStudent = async (payload: Omit<IrregularStudent, 'student_id' | 'created_at'>) => {
    const res = await fetch('/api/scheduleCommittee/irregular-students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create');
    return { ...payload, student_id: data.student_id } as IrregularStudent;
  };

  const deleteIrregularStudent = async (student_id: number) => {
    const res = await fetch(`/api/scheduleCommittee/irregular-students/${student_id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // For university_id, only allow digits
    if (name === 'university_id') {
      const digitsOnly = value.replace(/\D/g, '');
      setFormData(prev => ({
        ...prev,
        [name]: digitsOnly
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: name === 'level' ? Number(value) : value
      }));
    }
    
    if (errors[name]) setErrors((prev: any) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.university_id.trim()) {
      newErrors.university_id = 'University ID is required';
    } else if (!/^\d{9}$/.test(formData.university_id)) {
      newErrors.university_id = 'University ID must be exactly 9 digits';
    } else if (!formData.university_id.startsWith('44')) {
      newErrors.university_id = 'University ID must start with 44';
    }
    if (formData.remaining_courses.length === 0) newErrors.remaining_courses = 'At least one course must be selected';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const payload: Omit<IrregularStudent, 'student_id' | 'created_at'> = {
        name: formData.name.trim(),
        university_id: formData.university_id.trim(),
        level: formData.level,
        remaining_courses: formData.remaining_courses,
      };
      const created = await createIrregularStudent(payload);
      setStudents(prev => [created, ...prev]);
      setAlert({ type: 'success', message: 'Irregular student added successfully!' });
      setShowAddModal(false);
      setFormData({ name: '', university_id: '', level: 6, remaining_courses: [] });
    } catch (err: any) {
      setAlert({ type: 'danger', message: `Failed to add irregular student: ${err.message || err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this irregular student?')) return;
    try {
      await deleteIrregularStudent(id);
      setStudents(prev => prev.filter(s => s.student_id !== id));
      setAlert({ type: 'success', message: 'Irregular student deleted successfully!' });
    } catch (err: any) {
      setAlert({ type: 'danger', message: `Failed to delete irregular student: ${err.message || err}` });
    }
  };

  const isSelected = (code: string) => formData.remaining_courses.includes(code);

  const toggleCourse = (code: string) => {
    setFormData(prev => ({
      ...prev,
      remaining_courses: isSelected(code)
        ? prev.remaining_courses.filter(c => c !== code)
        : [...prev.remaining_courses, code]
    }));
    if (errors.remaining_courses) setErrors((p: any) => ({ ...p, remaining_courses: '' }));
  };

  const selectGroup = (key: keyof typeof coursesByLevel) => {
    const codes = (coursesByLevel[key] || []).map(c => c.course_code);
    setFormData(prev => ({
      ...prev,
      remaining_courses: Array.from(new Set([...prev.remaining_courses, ...codes]))
    }));
    if (errors.remaining_courses) setErrors((p: any) => ({ ...p, remaining_courses: '' }));
  };

  const clearGroup = (key: keyof typeof coursesByLevel) => {
    const codes = new Set((coursesByLevel[key] || []).map(c => c.course_code));
    setFormData(prev => ({
      ...prev,
      remaining_courses: prev.remaining_courses.filter(c => !codes.has(c))
    }));
  };

  const groupSelectedCount = (key: keyof typeof coursesByLevel) =>
    (coursesByLevel[key] || []).filter(c => isSelected(c.course_code)).length;

  // Filter students by level
  const filteredStudents = filterLevel === 'all' 
    ? students 
    : students.filter(s => s.level === filterLevel);

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1" style={{ color: '#1e3a5f' }}>
                <i className="fas fa-user-graduate me-2"></i>
                Irregular Students Management
              </h2>
              <p className="text-muted mb-0">Manage students with irregular course requirements</p>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2"
              style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none', borderRadius: '10px' }}
            >
              <i className="fas fa-plus me-2"></i>
              Add Irregular Student
            </Button>
          </div>
        </Col>
      </Row>

      {/* Alert */}
      {alert && (
        <Row className="mb-4">
          <Col>
            <Alert variant={alert.type} dismissible onClose={() => setAlert(null)} className="border-0 shadow-sm">
              <i className={`fas ${alert.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-2`}></i>
              {alert.message}
            </Alert>
          </Col>
        </Row>
      )}

      {/* Statistics */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="fas fa-users text-primary" style={{ fontSize: '2rem' }}></i>
              </div>
              <h4 className="mb-1" style={{ color: '#1e3a5f' }}>{students.length}</h4>
              <p className="text-muted mb-0">Total Irregular Students</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="fas fa-graduation-cap text-success" style={{ fontSize: '2rem' }}></i>
              </div>
              <h4 className="mb-1" style={{ color: '#1e3a5f' }}>
                {students.reduce((sum, s) => sum + s.remaining_courses.length, 0)}
              </h4>
              <p className="text-muted mb-0">Total Remaining Courses</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="fas fa-chart-bar text-warning" style={{ fontSize: '2rem' }}></i>
              </div>
              <h4 className="mb-1" style={{ color: '#1e3a5f' }}>
                {students.length > 0 ? (students.reduce((s, x) => s + x.remaining_courses.length, 0) / students.length).toFixed(1) : 0}
              </h4>
              <p className="text-muted mb-0">Avg Courses per Student</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="fas fa-calendar-alt text-info" style={{ fontSize: '2rem' }}></i>
              </div>
              <h4 className="mb-1" style={{ color: '#1e3a5f' }}>
                {new Set(students.map((s) => s.level)).size}
              </h4>
              <p className="text-muted mb-0">Levels Affected</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Students table */}
      <Row>
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header
              className="text-white py-3 border-0"
              style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', borderRadius: '10px 10px 0 0' }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="fas fa-list me-2"></i>
                  Irregular Students List
                </h5>
                <div className="d-flex align-items-center gap-2">
                  <span className="me-2">Filter by Level:</span>
                  <Form.Select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    style={{ width: 'auto', borderRadius: '8px' }}
                    size="sm"
                  >
                    <option value="all">All Levels</option>
                    <option value="6">Level 6</option>
                    <option value="7">Level 7</option>
                    <option value="8">Level 8</option>
                  </Form.Select>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {isLoading ? (
                <div className="text-center py-5">
                  <i className="fas fa-spinner fa-spin text-primary" style={{ fontSize: '2rem' }}></i>
                  <p className="mt-3 text-muted">Loading irregular students...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-user-graduate text-muted" style={{ fontSize: '3rem' }}></i>
                  <p className="mt-3 text-muted">
                    {filterLevel === 'all' ? 'No irregular students found' : `No irregular students found in Level ${filterLevel}`}
                  </p>
                  {filterLevel !== 'all' && (
                    <Button variant="outline-primary" onClick={() => setFilterLevel('all')} className="mt-2">
                      Show All Levels
                    </Button>
                  )}
                  {filterLevel === 'all' && (
                    <Button variant="outline-primary" onClick={() => setShowAddModal(true)} className="mt-2">
                      Add First Student
                    </Button>
                  )}
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead style={{ background: '#f8f9fa' }}>
                      <tr>
                        <th className="border-0 py-3">Name</th>
                        <th className="border-0 py-3">University ID</th>
                        <th className="border-0 py-3">Level</th>
                        <th className="border-0 py-3">Remaining Courses</th>
                        <th className="border-0 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.student_id}>
                          <td className="py-3">
                            <div className="d-flex align-items-center">
                              <div
                                className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3"
                                style={{ width: '40px', height: '40px', fontSize: '14px' }}
                              >
                                {student.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                              </div>
                              <div>
                                <div className="fw-semibold" style={{ color: '#1e3a5f' }}>{student.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <code className="bg-light px-2 py-1 rounded">{student.university_id}</code>
                          </td>
                          <td className="py-3">
                            <Badge bg="info" className="px-3 py-2">Level {student.level}</Badge>
                          </td>
                          <td className="py-3">
                            <div className="d-flex flex-wrap gap-1">
                              {student.remaining_courses?.map((course, idx) => (
                                <Badge key={idx} bg="secondary" className="px-2 py-1">
                                  {course}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(student.student_id)}
                              className="px-3"
                            >
                              <i className="fas fa-trash"></i>
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
        </Col>
      </Row>

      {/* Add Student Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg" centered>
        <Modal.Header
          closeButton
          className="text-white border-0"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' }}
        >
          <Modal.Title>
            <i className="fas fa-user-plus me-2"></i>
            Add Irregular Student
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                    <i className="fas fa-user me-2"></i>
                    Student Name *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter student full name"
                    className={errors.name ? 'is-invalid' : ''}
                    style={{ borderRadius: '8px' }}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                    <i className="fas fa-id-card me-2"></i>
                    University ID *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="university_id"
                    value={formData.university_id}
                    onChange={handleInputChange}
                    placeholder="Enter 9-digit ID starting with 44"
                    maxLength={9}
                    className={errors.university_id ? 'is-invalid' : ''}
                    style={{ borderRadius: '8px' }}
                  />
                  {errors.university_id && <div className="invalid-feedback">{errors.university_id}</div>}
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                    <i className="fas fa-layer-group me-2"></i>
                    Academic Level *
                  </Form.Label>
                  <Form.Select
                    name="level"
                    value={formData.level}
                    onChange={handleInputChange}
                    style={{ borderRadius: '8px' }}
                  >
                    {levels.map((level) => (
                      <option key={level} value={level}>Level {level}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>
                <i className="fas fa-book me-2"></i>
                Remaining Courses *
              </Form.Label>
              <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                {/* Debug info */}
                {Object.keys(coursesByLevel).length === 0 && (
                  <div className="text-center py-3">
                    <i className="fas fa-spinner fa-spin text-primary me-2"></i>
                    <span className="text-muted">Loading courses...</span>
                  </div>
                )}
                
                {Object.keys(coursesByLevel).length > 0 && 
                 !coursesByLevel.level3 && !coursesByLevel.level4 && !coursesByLevel.level5 && 
                 !coursesByLevel.level6 && !coursesByLevel.level7 && !coursesByLevel.level8 && 
                 !coursesByLevel.electives && (
                  <div className="text-center py-3">
                    <i className="fas fa-exclamation-circle text-warning me-2"></i>
                    <span className="text-muted">No courses available</span>
                  </div>
                )}

                {/* Level 3 Courses */}
                {coursesByLevel.level3 && coursesByLevel.level3.length > 0 && (
                  <div className="mb-3 border rounded p-2 bg-white">
                    <div className="d-flex align-items-center mb-2 bg-primary bg-opacity-10 p-2 rounded">
                      <Form.Check
                        type="checkbox"
                        id="select-all-level3"
                        checked={coursesByLevel.level3.every(c => formData.remaining_courses.includes(c.course_code))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectGroup('level3');
                          } else {
                            clearGroup('level3');
                          }
                        }}
                        className="me-2"
                      />
                      <h6 className="mb-0 text-primary flex-grow-1">
                        <i className="fas fa-layer-group me-1"></i> Level 3 Courses
                      </h6>
                      <Badge bg="primary" pill>{groupSelectedCount('level3')}/{coursesByLevel.level3.length}</Badge>
                    </div>
                    <div className="row ps-4">
                      {coursesByLevel.level3.map(course => (
                        <div key={course.course_code} className="col-md-4 col-sm-6 mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`course-${course.course_code}`}
                            label={course.course_code}
                            checked={formData.remaining_courses.includes(course.course_code)}
                            onChange={() => toggleCourse(course.course_code)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 4 Courses */}
                {coursesByLevel.level4 && coursesByLevel.level4.length > 0 && (
                  <div className="mb-3 border rounded p-2 bg-white">
                    <div className="d-flex align-items-center mb-2 bg-primary bg-opacity-10 p-2 rounded">
                      <Form.Check
                        type="checkbox"
                        id="select-all-level4"
                        checked={coursesByLevel.level4.every(c => formData.remaining_courses.includes(c.course_code))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectGroup('level4');
                          } else {
                            clearGroup('level4');
                          }
                        }}
                        className="me-2"
                      />
                      <h6 className="mb-0 text-primary flex-grow-1">
                        <i className="fas fa-layer-group me-1"></i> Level 4 Courses
                      </h6>
                      <Badge bg="primary" pill>{groupSelectedCount('level4')}/{coursesByLevel.level4.length}</Badge>
                    </div>
                    <div className="row ps-4">
                      {coursesByLevel.level4.map(course => (
                        <div key={course.course_code} className="col-md-4 col-sm-6 mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`course-${course.course_code}`}
                            label={course.course_code}
                            checked={formData.remaining_courses.includes(course.course_code)}
                            onChange={() => toggleCourse(course.course_code)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 5 Courses */}
                {coursesByLevel.level5 && coursesByLevel.level5.length > 0 && (
                  <div className="mb-3 border rounded p-2 bg-white">
                    <div className="d-flex align-items-center mb-2 bg-primary bg-opacity-10 p-2 rounded">
                      <Form.Check
                        type="checkbox"
                        id="select-all-level5"
                        checked={coursesByLevel.level5.every(c => formData.remaining_courses.includes(c.course_code))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectGroup('level5');
                          } else {
                            clearGroup('level5');
                          }
                        }}
                        className="me-2"
                      />
                      <h6 className="mb-0 text-primary flex-grow-1">
                        <i className="fas fa-layer-group me-1"></i> Level 5 Courses
                      </h6>
                      <Badge bg="primary" pill>{groupSelectedCount('level5')}/{coursesByLevel.level5.length}</Badge>
                    </div>
                    <div className="row ps-4">
                      {coursesByLevel.level5.map(course => (
                        <div key={course.course_code} className="col-md-4 col-sm-6 mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`course-${course.course_code}`}
                            label={course.course_code}
                            checked={formData.remaining_courses.includes(course.course_code)}
                            onChange={() => toggleCourse(course.course_code)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 6 Courses */}
                {coursesByLevel.level6 && coursesByLevel.level6.length > 0 && (
                  <div className="mb-3 border rounded p-2 bg-white">
                    <div className="d-flex align-items-center mb-2 bg-primary bg-opacity-10 p-2 rounded">
                      <Form.Check
                        type="checkbox"
                        id="select-all-level6"
                        checked={coursesByLevel.level6.every(c => formData.remaining_courses.includes(c.course_code))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectGroup('level6');
                          } else {
                            clearGroup('level6');
                          }
                        }}
                        className="me-2"
                      />
                      <h6 className="mb-0 text-primary flex-grow-1">
                        <i className="fas fa-layer-group me-1"></i> Level 6 Courses
                      </h6>
                      <Badge bg="primary" pill>{groupSelectedCount('level6')}/{coursesByLevel.level6.length}</Badge>
                    </div>
                    <div className="row ps-4">
                      {coursesByLevel.level6.map(course => (
                        <div key={course.course_code} className="col-md-4 col-sm-6 mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`course-${course.course_code}`}
                            label={course.course_code}
                            checked={formData.remaining_courses.includes(course.course_code)}
                            onChange={() => toggleCourse(course.course_code)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 7 Courses */}
                {coursesByLevel.level7 && coursesByLevel.level7.length > 0 && (
                  <div className="mb-3 border rounded p-2 bg-white">
                    <div className="d-flex align-items-center mb-2 bg-primary bg-opacity-10 p-2 rounded">
                      <Form.Check
                        type="checkbox"
                        id="select-all-level7"
                        checked={coursesByLevel.level7.every(c => formData.remaining_courses.includes(c.course_code))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectGroup('level7');
                          } else {
                            clearGroup('level7');
                          }
                        }}
                        className="me-2"
                      />
                      <h6 className="mb-0 text-primary flex-grow-1">
                        <i className="fas fa-layer-group me-1"></i> Level 7 Courses
                      </h6>
                      <Badge bg="primary" pill>{groupSelectedCount('level7')}/{coursesByLevel.level7.length}</Badge>
                    </div>
                    <div className="row ps-4">
                      {coursesByLevel.level7.map(course => (
                        <div key={course.course_code} className="col-md-4 col-sm-6 mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`course-${course.course_code}`}
                            label={course.course_code}
                            checked={formData.remaining_courses.includes(course.course_code)}
                            onChange={() => toggleCourse(course.course_code)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 8 Courses */}
                {coursesByLevel.level8 && coursesByLevel.level8.length > 0 && (
                  <div className="mb-3 border rounded p-2 bg-white">
                    <div className="d-flex align-items-center mb-2 bg-primary bg-opacity-10 p-2 rounded">
                      <Form.Check
                        type="checkbox"
                        id="select-all-level8"
                        checked={coursesByLevel.level8.every(c => formData.remaining_courses.includes(c.course_code))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectGroup('level8');
                          } else {
                            clearGroup('level8');
                          }
                        }}
                        className="me-2"
                      />
                      <h6 className="mb-0 text-primary flex-grow-1">
                        <i className="fas fa-layer-group me-1"></i> Level 8 Courses
                      </h6>
                      <Badge bg="primary" pill>{groupSelectedCount('level8')}/{coursesByLevel.level8.length}</Badge>
                    </div>
                    <div className="row ps-4">
                      {coursesByLevel.level8.map(course => (
                        <div key={course.course_code} className="col-md-4 col-sm-6 mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`course-${course.course_code}`}
                            label={course.course_code}
                            checked={formData.remaining_courses.includes(course.course_code)}
                            onChange={() => toggleCourse(course.course_code)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Elective Courses */}
                {coursesByLevel.electives && coursesByLevel.electives.length > 0 && (
                  <div className="mb-3 border rounded p-2 bg-white">
                    <div className="d-flex align-items-center mb-2 bg-success bg-opacity-10 p-2 rounded">
                      <Form.Check
                        type="checkbox"
                        id="select-all-electives"
                        checked={coursesByLevel.electives.every(c => formData.remaining_courses.includes(c.course_code))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectGroup('electives');
                          } else {
                            clearGroup('electives');
                          }
                        }}
                        className="me-2"
                      />
                      <h6 className="mb-0 text-success flex-grow-1">
                        <i className="fas fa-star me-1"></i> Elective Courses
                      </h6>
                      <Badge bg="success" pill>{groupSelectedCount('electives')}/{coursesByLevel.electives.length}</Badge>
                    </div>
                    <div className="row ps-4">
                      {coursesByLevel.electives.map(course => (
                        <div key={course.course_code} className="col-md-4 col-sm-6 mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`course-${course.course_code}`}
                            label={course.course_code}
                            checked={formData.remaining_courses.includes(course.course_code)}
                            onChange={() => toggleCourse(course.course_code)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {errors.remaining_courses && (
                <div className="text-danger mt-2">
                  <small>{errors.remaining_courses}</small>
                </div>
              )}
              <Form.Text className="text-muted">
                Check the box next to a level to select/deselect all courses in that level
              </Form.Text>

              {/* Selected Courses Summary */}
              {formData.remaining_courses.length > 0 && (
                <div className="mt-3 p-3 bg-light rounded border">
                  <h6 className="mb-2 fw-semibold">Selected Courses ({formData.remaining_courses.length}):</h6>
                  <div className="d-flex flex-wrap gap-1">
                    {formData.remaining_courses.map(courseCode => (
                      <Badge key={courseCode} bg="primary" className="px-2 py-1">
                        {courseCode}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 ms-1 text-white"
                          onClick={() => toggleCourse(courseCode)}
                          style={{ textDecoration: 'none' }}
                        >
                          <i className="fas fa-times"></i>
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button
                variant="outline-secondary"
                onClick={() => setShowAddModal(false)}
                className="px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="px-4"
                style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none', borderRadius: '8px' }}
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin me-2"></i>
                    Adding...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus me-2"></i>
                    Add Student
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default IrregularStudentsPage;