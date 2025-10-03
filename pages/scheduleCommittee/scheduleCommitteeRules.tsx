import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Badge, Modal, Alert, Nav, Spinner } from 'react-bootstrap';
import Layout from '../../components/Layout';
import 'bootstrap-icons/font/bootstrap-icons.css';

interface SchedulingRule {
  rule_id: number;
  rule_name: string;
  rule_description: string;
  rule_type: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface RuleFormData {
  rule_name: string;
  rule_description: string;
  rule_type: string;
  priority: number;
  is_active: boolean;
}

const RuleManagementPage: React.FC = () => {
  const [rules, setRules] = useState<SchedulingRule[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [editingRule, setEditingRule] = useState<SchedulingRule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger', message: string} | null>(null);

  const [formData, setFormData] = useState<RuleFormData>({
    rule_name: '',
    rule_description: '',
    rule_type: 'time_block',
    priority: 3,
    is_active: true
  });

  const ruleTypes = [
    { value: 'time_block', label: 'Time Block' },
    { value: 'constraint', label: 'Constraint' },
    { value: 'preference', label: 'Preference' },
    { value: 'distribution', label: 'Distribution' }
  ];

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/scheduleCommittee/scheduleCommitteeRules');
      const data = await response.json();
      if (data.success) {
        setRules(data.rules || []);
      } else {
        setAlert({type: 'danger', message: data.message || 'Failed to fetch rules'});
      }
    } catch (error) {
      setAlert({type: 'danger', message: 'Error connecting to server'});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = modalType === 'add' 
        ? '/api/scheduleCommittee/scheduleCommitteeRules' 
        : `/api/scheduleCommittee/scheduleCommitteeRules?id=${editingRule?.rule_id}`;
      const method = modalType === 'add' ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: `Rule ${modalType === 'add' ? 'created' : 'updated'} successfully`});
        fetchRules();
        resetForm();
        setShowModal(false);
      } else {
        setAlert({type: 'danger', message: data.message || 'Operation failed'});
      }
    } catch (error) {
      setAlert({type: 'danger', message: 'Network error. Please try again.'});
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      rule_description: '',
      rule_type: 'time_block',
      priority: 3,
      is_active: true
    });
    setEditingRule(null);
  };

  const handleEdit = (rule: SchedulingRule) => {
    setEditingRule(rule);
    setModalType('edit');
    setFormData({
      rule_name: rule.rule_name,
      rule_description: rule.rule_description,
      rule_type: rule.rule_type,
      priority: rule.priority,
      is_active: rule.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/scheduleCommittee/scheduleCommitteeRules?id=${ruleId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: 'Rule deleted successfully'});
        fetchRules();
      } else {
        setAlert({type: 'danger', message: data.message || 'Failed to delete rule'});
      }
    } catch (error) {
      setAlert({type: 'danger', message: 'Error deleting rule'});
    }
  };

  const getFilteredRules = () => {
    if (activeTab === 'all') return rules;
    return rules.filter(rule => rule.rule_type === activeTab);
  };

  const getRuleTypeInfo = (type: string) => {
    return ruleTypes.find(rt => rt.value === type) || ruleTypes[0];
  };

  return (
    <Layout>
      <div style={{ background: '#ececec', minHeight: '100vh' }}>
        <Container className="py-4">
          <div className="mb-4">
            <h2 className="fw-bold mb-2" style={{ color: '#1e3a5f' }}>
              Rules Management
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              Define and manage scheduling rules for SmartSchedule
            </p>
          </div>

          {alert && (
            <Alert variant={alert.type} onClose={() => setAlert(null)} dismissible className="mb-4 border-0 shadow-sm">
              {alert.message}
            </Alert>
          )}

          {/* Actions Card */}
          <Row className="mb-4 g-3">
            <Col lg={12}>
              <Card className="border-0 shadow-sm" style={{ background: 'white' }}>
                <Card.Body>
                  <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>Actions</h6>
                  <Button 
                    className="border-0 shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                      color: 'white',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
                    }}
                    onClick={() => {
                      setModalType('add');
                      resetForm();
                      setShowModal(true);
                    }}
                  >
                    <i className="bi bi-plus-lg me-2"></i>
                    Add New Rule
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tabs */}
          <Card className="mb-4 border-0 shadow-sm">
            <Card.Body className="p-0" style={{ background: 'white' }}>
              <Nav variant="tabs" className="px-3 pt-2" style={{ borderBottom: '1px solid #dee2e6' }}>
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'all'}
                    onClick={() => setActiveTab('all')}
                    style={{
                      color: activeTab === 'all' ? '#1e3a5f' : '#5a7a99',
                      fontWeight: activeTab === 'all' ? '600' : '400',
                      border: 'none',
                      borderBottom: activeTab === 'all' ? '3px solid #1e3a5f' : 'none'
                    }}
                  >
                    All Rules ({rules.length})
                  </Nav.Link>
                </Nav.Item>
                {ruleTypes.map(type => {
                  const count = rules.filter(r => r.rule_type === type.value).length;
                  const isActive = activeTab === type.value;
                  return (
                    <Nav.Item key={type.value}>
                      <Nav.Link 
                        active={isActive}
                        onClick={() => setActiveTab(type.value)}
                        style={{
                          color: isActive ? '#1e3a5f' : '#5a7a99',
                          fontWeight: isActive ? '600' : '400',
                          border: 'none',
                          borderBottom: isActive ? '3px solid #1e3a5f' : 'none'
                        }}
                      >
                        {type.label} ({count})
                      </Nav.Link>
                    </Nav.Item>
                  );
                })}
              </Nav>
            </Card.Body>
          </Card>

          {/* Rules Table */}
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-0">
              {isLoading ? (
                <div className="text-center p-5">
                  <Spinner animation="border" style={{ color: '#1e3a5f' }} />
                  <p className="mt-3" style={{ color: '#1e3a5f' }}>Loading rules...</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table className="mb-0" style={{ minWidth: '800px' }}>
                    <thead>
                      <tr style={{ background: '#87CEEB' }}>
                        <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none' }}>Rule Name</th>
                        <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none', borderLeft: '1px solid #dee2e6' }}>Type</th>
                        <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none', borderLeft: '1px solid #dee2e6' }}>Priority</th>
                        <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none', borderLeft: '1px solid #dee2e6' }}>Status</th>
                        <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none', borderLeft: '1px solid #dee2e6' }}>Created</th>
                        <th style={{ color: '#1e3a5f', fontWeight: '600', padding: '12px', border: 'none', borderLeft: '1px solid #dee2e6' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredRules().map((rule, idx) => {
                        const typeInfo = getRuleTypeInfo(rule.rule_type);
                        return (
                          <tr key={rule.rule_id}>
                            <td className="fw-semibold align-middle" style={{ 
                              color: '#1e3a5f', 
                              padding: '12px',
                              background: 'white',
                              border: 'none',
                              borderTop: idx > 0 ? '1px solid #dee2e6' : 'none'
                            }}>
                              {rule.rule_name}
                            </td>
                            <td className="align-middle" style={{ 
                              padding: '12px',
                              background: 'white',
                              border: 'none',
                              borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                              borderLeft: '1px solid #dee2e6'
                            }}>
                              <span style={{
                                background: '#e6f4ff',
                                color: '#1e3a5f',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                fontWeight: '500'
                              }}>
                                {typeInfo.label}
                              </span>
                            </td>
                            <td className="align-middle" style={{ 
                              padding: '12px',
                              background: 'white',
                              border: 'none',
                              borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                              borderLeft: '1px solid #dee2e6'
                            }}>
                              <span style={{
                                background: '#b0c4d4',
                                color: '#1e3a5f',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                fontWeight: '500'
                              }}>
                                Priority {rule.priority}
                              </span>
                            </td>
                            <td className="align-middle" style={{ 
                              padding: '12px',
                              background: 'white',
                              border: 'none',
                              borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                              borderLeft: '1px solid #dee2e6'
                            }}>
                              <span style={{
                                background: rule.is_active ? '#87CEEB' : '#b0c4d4',
                                color: '#1e3a5f',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                fontWeight: '500'
                              }}>
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="align-middle" style={{ 
                              color: '#5a7a99',
                              padding: '12px',
                              background: 'white',
                              border: 'none',
                              borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                              borderLeft: '1px solid #dee2e6',
                              fontSize: '0.9rem'
                            }}>
                              {new Date(rule.created_at).toLocaleDateString()}
                            </td>
                            <td className="align-middle" style={{ 
                              padding: '12px',
                              background: 'white',
                              border: 'none',
                              borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                              borderLeft: '1px solid #dee2e6'
                            }}>
                              <div className="d-flex gap-2">
                                <Button 
                                  size="sm"
                                  className="border-0"
                                  style={{ background: '#87CEEB', color: '#1e3a5f', padding: '4px 12px' }}
                                  onClick={() => handleEdit(rule)}
                                >
                                  <i className="bi bi-pencil"></i>
                                </Button>
                                <Button 
                                  size="sm"
                                  className="border-0"
                                  style={{ background: '#b0c4d4', color: '#1e3a5f', padding: '4px 12px' }}
                                  onClick={() => handleDelete(rule.rule_id)}
                                >
                                  <i className="bi bi-trash"></i>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
              
              {getFilteredRules().length === 0 && !isLoading && (
                <div className="text-center p-5" style={{ color: '#5a7a99' }}>
                  <i className="bi bi-inbox" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
                  <h5 className="mt-3">No rules found</h5>
                  <p>Start by creating your first scheduling rule.</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Modal */}
          <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
            <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', border: 'none' }} className="text-white">
              <Modal.Title className="fw-semibold">
                <i className="bi bi-gear me-2"></i>
                {modalType === 'add' ? 'Add New Rule' : 'Edit Rule'}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ background: 'white' }}>
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Rule Type</Form.Label>
                      <Form.Select
                        value={formData.rule_type}
                        onChange={(e) => setFormData({...formData, rule_type: e.target.value})}
                        required
                        className="border-2"
                        style={{ borderColor: '#87CEEB', color: '#1e3a5f' }}
                      >
                        {ruleTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Priority (1 = Highest)</Form.Label>
                      <Form.Select
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                        required
                        className="border-2"
                        style={{ borderColor: '#87CEEB', color: '#1e3a5f' }}
                      >
                        <option value={1}>1 - Critical</option>
                        <option value={2}>2 - High</option>
                        <option value={3}>3 - Medium</option>
                        <option value={4}>4 - Low</option>
                        <option value={5}>5 - Lowest</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Rule Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.rule_name}
                    onChange={(e) => setFormData({...formData, rule_name: e.target.value})}
                    placeholder="Enter rule name"
                    required
                    className="border-2"
                    style={{ borderColor: '#87CEEB' }}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold" style={{ color: '#1e3a5f' }}>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.rule_description}
                    onChange={(e) => setFormData({...formData, rule_description: e.target.value})}
                    placeholder="Describe what this rule does"
                    required
                    className="border-2"
                    style={{ borderColor: '#87CEEB' }}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    label="Rule is active"
                    style={{ color: '#1e3a5f', fontWeight: '500' }}
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer style={{ background: 'white', borderTop: '1px solid #dee2e6' }}>
              <Button 
                className="border-0"
                style={{ background: '#b0c4d4', color: '#1e3a5f', padding: '8px 20px' }}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button 
                className="border-0 shadow-sm"
                style={{ 
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                  color: 'white',
                  padding: '8px 20px'
                }}
                onClick={handleSubmit} 
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Rule'}
              </Button>
            </Modal.Footer>
          </Modal>
        </Container>
      </div>
    </Layout>
  );
};

export default RuleManagementPage;