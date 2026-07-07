import Header from '@/components/shared/Header';
import TransformationForm from '@/components/shared/TransformationForm';
import { transformationTypes } from '@/constants';
import { getOrCreateUser } from '@/lib/actions/user.action';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import React from 'react'

const AddTransformationTypePage = async (props: SearchParamProps) => {
  const { type } = await props.params;

  // The route param is user-controlled at runtime; reject unknown types.
  if (!Object.prototype.hasOwnProperty.call(transformationTypes, type)) {
    notFound();
  }

  const transformation = transformationTypes[type];
  const {userId} = await auth();

  if (!userId) redirect('/sign-in');

  const user = await getOrCreateUser(userId);

  return (
    <>
    <Header 
    title={transformation.title}
    subtitle={transformation.subTitle }
    />

    <section className='mt-10'>
    <TransformationForm 
    action='Add'
    userId={user._id}
    type={transformation.type as TransformationTypeKey}
    creditBalance = {user.creditBalance}
    />
    

    </section>
    </>
  )
}

export default AddTransformationTypePage;
