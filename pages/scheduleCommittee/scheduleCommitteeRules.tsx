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
    { value: 'time_block', label: 'Time Block', variant: 'secondary' },
    { value: 'constraint', label: 'Constraint',  variant: 'primary' },
    { value: 'preference', label: 'Preference', variant: 'secondary' },
    { value: 'distribution', label: 'Distribution',  variant: 'primary' }
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

  const getPriorityVariant = (priority: number) => {
    if (priority <= 2) return 'primary';
    if (priority <= 3) return 'secondary';
    return 'light';
  };

  return (
    <Layout>
      <style>{`
        :root {
          --bs-primary: #2F4156;
          --bs-primary-rgb: 47, 65, 86;
          --bs-secondary: #567C8D;
          --bs-secondary-rgb: 86, 124, 141;
          --bs-light: #C8D9E6;
          --bs-light-rgb: 200, 217, 230;
          --bs-success: #567C8D;
          --bs-success-rgb: 86, 124, 141;
        }
        .bg-beige {
          background-color: #F5EFEB !important;
        }
        .text-navy {
          color: #2F4156 !important;
        }
        .text-teal {
          color: #567C8D !important;
        }
      `}</style>
      
      <Container className="py-4">
        {alert && (
          <Alert variant={alert.type} onClose={() => setAlert(null)} dismissible className="mb-4">
            {alert.message}
          </Alert>
        )}

        {/* Header */}
        <Card className="mb-4">
          <Card.Header className="bg-primary text-white">
            <Row className="align-items-center">
              <Col>
                <h4 className="mb-0">
                  <i className="bi bi-gear me-2"></i>
                  Scheduling Rules Management
                </h4>
                <small>Define and manage scheduling rules for SmartSchedule</small>
              </Col>
              <Col xs="auto">
                <Button 
                  variant="light"
                  onClick={() => {
                    setModalType('add');
                    resetForm();
                    setShowModal(true);
                  }}
                >
                  <i className="bi bi-plus-lg me-1"></i>
                  Add Rule
                </Button>
              </Col>
            </Row>
          </Card.Header>
        </Card>

        {/* Tabs */}
        <Card className="mb-4">
          <Card.Body className="p-0">
            <Nav variant="tabs">
              <Nav.Item>
                <Nav.Link 
                  active={activeTab === 'all'}
                  onClick={() => setActiveTab('all')}
                >
                  All Rules ({rules.length})
                </Nav.Link>
              </Nav.Item>
              {ruleTypes.map(type => {
                const count = rules.filter(r => r.rule_type === type.value).length;
                return (
                  <Nav.Item key={type.value}>
                    <Nav.Link 
                      active={activeTab === type.value}
                      onClick={() => setActiveTab(type.value)}
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
        <Card>
          <Card.Body className="p-0">
            {isLoading ? (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Loading rules...</p>
              </div>
            ) : (
              <Table responsive hover className="mb-0">
                <thead className="bg-beige">
                  <tr>
                    <th className="text-navy">Rule Name</th>
                    <th className="text-navy">Type</th>
                    <th className="text-navy">Priority</th>
                    <th className="text-navy">Status</th>
                    <th className="text-navy">Created</th>
                    <th className="text-navy">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredRules().map(rule => {
                    const typeInfo = getRuleTypeInfo(rule.rule_type);
                    return (
                      <tr key={rule.rule_id}>
                        <td className="fw-bold text-navy">{rule.rule_name}</td>
                        <td>
                          <Badge bg={typeInfo.variant}>
                            {typeInfo.label}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={getPriorityVariant(rule.priority)}>
                            {rule.priority}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={rule.is_active ? 'success' : 'light'} 
                                 text={rule.is_active ? 'white' : 'dark'}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-teal">
                          {new Date(rule.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button 
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(rule)}
                            >
                              <i className="bi bi-pencil"></i>
                            </Button>
                            <Button 
                              variant="outline-secondary"
                              size="sm"
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
            )}
            
            {getFilteredRules().length === 0 && !isLoading && (
              <div className="text-center p-5 text-muted">
                <i className="bi bi-inbox display-1"></i>
                <h5>No rules found</h5>
                <p>Start by creating your first scheduling rule.</p>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Modal */}
        <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
          <Modal.Header closeButton className="bg-primary text-white">
            <Modal.Title>
              <i className="bi bi-gear me-2"></i>
              {modalType === 'add' ? 'Add New Rule' : 'Edit Rule'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="bg-beige">
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="text-navy">Rule Type</Form.Label>
                    <Form.Select
                      value={formData.rule_type}
                      onChange={(e) => setFormData({...formData, rule_type: e.target.value})}
                      required
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
                    <Form.Label className="text-navy">Priority (1 = Highest)</Form.Label>
                    <Form.Select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                      required
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
                <Form.Label className="text-navy">Rule Name</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.rule_name}
                  onChange={(e) => setFormData({...formData, rule_name: e.target.value})}
                  placeholder="Enter rule name"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="text-navy">Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={formData.rule_description}
                  onChange={(e) => setFormData({...formData, rule_description: e.target.value})}
                  placeholder="Describe what this rule does"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  label="Rule is active"
                  className="text-navy"
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer className="bg-beige">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Rule'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </Layout>
  );
};

export default RuleManagementPage;