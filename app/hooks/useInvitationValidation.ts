/**
 * Invitation Validation Hook
 * Following DataWorkbench Architecture Standards:
 * - React hook for invitation validation
 * - Real-time validation feedback
 * - Integration with signup flow
 */

'use client';

import { useState, useEffect } from 'react';
import { validateInvitationClient, checkPendingInvitation } from '@/utils/invitation-validation';
import type { UserInvitation } from '@/types/invitationTypes';

interface InvitationValidationState {
  isValid: boolean | null;
  isLoading: boolean;
  error: string | null;
  invitation: Partial<UserInvitation> | null;
}

export function useInvitationValidation(code?: string, email?: string) {
  const [state, setState] = useState<InvitationValidationState>({
    isValid: null,
    isLoading: false,
    error: null,
    invitation: null
  });

  const validateInvitation = async (invitationCode: string, userEmail: string) => {
    if (!invitationCode || !userEmail) {
      setState({
        isValid: false,
        isLoading: false,
        error: 'Invitation code and email are required',
        invitation: null
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await validateInvitationClient(invitationCode, userEmail);
      
      if (result.isValid) {
        // Get invitation details
        const invitation = await checkPendingInvitation(userEmail);
        
        setState({
          isValid: true,
          isLoading: false,
          error: null,
          invitation: invitation
        });
      } else {
        setState({
          isValid: false,
          isLoading: false,
          error: result.errors.join(', '),
          invitation: null
        });
      }

    } catch (error) {

      setState({
        isValid: false,
        isLoading: false,
        error: 'Unable to validate invitation',
        invitation: null
      });
    }
  };

  const checkEmailInvitation = async (userEmail: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const invitation = await checkPendingInvitation(userEmail);
      
      if (invitation) {
        setState({
          isValid: true,
          isLoading: false,
          error: null,
          invitation: invitation
        });
      } else {
        setState({
          isValid: false,
          isLoading: false,
          error: 'No pending invitation found for this email',
          invitation: null
        });
      }

    } catch (error) {

      setState({
        isValid: false,
        isLoading: false,
        error: 'Unable to check invitation status',
        invitation: null
      });
    }
  };

  const reset = () => {
    setState({
      isValid: null,
      isLoading: false,
      error: null,
      invitation: null
    });
  };

  // Auto-validate when code and email are provided
  useEffect(() => {
    if (code && email) {
      validateInvitation(code, email);
    }
  }, [code, email]);

  return {
    ...state,
    validateInvitation,
    checkEmailInvitation,
    reset
  };
}

/**
 * Hook for checking if an email has any pending invitations
 */
export function usePendingInvitation(email?: string) {
  const [invitation, setInvitation] = useState<Partial<UserInvitation> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkInvitation = async (userEmail: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await checkPendingInvitation(userEmail);
      setInvitation(result);
    } catch (error) {

      setError('Unable to check invitation status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (email) {
      checkInvitation(email);
    }
  }, [email]);

  return {
    invitation,
    isLoading,
    error,
    checkInvitation,
    hasInvitation: !!invitation
  };
}
