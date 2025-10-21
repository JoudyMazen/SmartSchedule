import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function TeachingLoadCommitteeIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/teachingLoadCommittee/teachingLoadCommitteeHomePage');
  }, [router]);

  return null;
}

