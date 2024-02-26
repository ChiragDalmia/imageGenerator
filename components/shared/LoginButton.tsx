import React from 'react'
import { Button } from '../ui/button'
import Link from 'next/link'

const LoginButton = () => {
  return (
    <Button asChild className='button  bg-white text-black hover:bg-slate-200 bg-cover'>
              <Link href='/sign-in'>Login</Link>
    </Button>
  )
}

export default LoginButton