import React, { useState, useRef, useEffect } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { Comment } from '../lib/types';

interface CommentsModalProps {
  show: boolean;
  onHide: () => void;
  comments: Comment[];
  onAddComment: (message: string) => void;
  level: number;
  group: number;
  isLoading?: boolean;
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  show,
  onHide,
  comments,
  onAddComment,
  level,
  group,
  isLoading = false,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (show) {
      // Scroll to bottom when modal opens or new comments arrive
      setTimeout(scrollToBottom, 100);
    }
  }, [show, comments]);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      onAddComment(newMessage);
      setNewMessage('');
      // Scroll to bottom after adding comment
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      backdrop="static"
      className="comments-modal"
    >
      <Modal.Header
        closeButton
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
          border: 'none',
          color: 'white',
        }}
      >
        <Modal.Title className="fw-semibold d-flex align-items-center">
          <i className="bi bi-chat-dots me-2"></i>
          Comments - Level {level}, Group {group}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body
        className="p-0 d-flex flex-column"
        style={{ maxHeight: '70vh', minHeight: '400px' }}
      >
        {/* Comments List */}
        <div
          ref={messagesContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            background: '#f8f9fa',
          }}
        >
          {isLoading && comments.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" style={{ color: '#1e3a5f' }} />
              <p className="mt-3 text-muted">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div
              className="text-center py-5 text-muted"
              style={{ fontSize: '0.95rem' }}
            >
              <i
                className="bi bi-chat-left"
                style={{ fontSize: '3rem', opacity: 0.3 }}
              ></i>
              <p className="mt-3 mb-0">No comments yet</p>
              <p className="small mb-0">Start the conversation!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    padding: '16px',
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e9ecef',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div
                        className="fw-semibold"
                        style={{ fontSize: '0.95rem', color: '#1e3a5f' }}
                      >
                        {comment.authorName}
                      </div>
                      <div
                        className="small text-muted"
                        style={{ fontSize: '0.8rem', marginTop: '2px' }}
                      >
                        {comment.authorRole}
                      </div>
                    </div>
                    <div
                      className="small text-muted"
                      style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: '12px' }}
                    >
                      {formatTimestamp(comment.createdAt)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
                      color: '#495057',
                      lineHeight: '1.6',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {comment.message}
                  </div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>
          )}
        </div>

        {/* Add Comment Form */}
        <div
          style={{
            borderTop: '1px solid #dee2e6',
            padding: '16px',
            background: 'white',
          }}
        >
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Add a comment..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                style={{
                  resize: 'none',
                  fontSize: '0.95rem',
                  borderColor: '#87CEEB',
                  borderRadius: '8px',
                }}
                disabled={isSubmitting}
              />
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button
                variant="secondary"
                onClick={onHide}
                className="me-2"
                style={{ border: 'none' }}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={!newMessage.trim() || isSubmitting}
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                  border: 'none',
                }}
                className="fw-semibold"
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Posting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-2"></i>
                    Post Comment
                  </>
                )}
              </Button>
            </div>
          </Form>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default CommentsModal;

