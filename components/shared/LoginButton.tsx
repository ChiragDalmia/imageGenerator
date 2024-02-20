import React from 'react'
import { Button } from '../ui/button'
import Link from 'next/link'

const LoginButton = () => {
  return (
    <Button asChild className='button bg-purple-gradient bg-cover'>
              <Link href='/sign-in'>Login</Link>
    </Button>
  )
}

export default LoginButton