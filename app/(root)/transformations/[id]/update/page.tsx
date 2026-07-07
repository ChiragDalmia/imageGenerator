import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import Header from "@/components/shared/Header";
import TransformationForm from "@/components/shared/TransformationForm";
import { transformationTypes } from "@/constants";
import { getOrCreateUser } from "@/lib/actions/user.action";
import { getImageById } from "@/lib/actions/image.queries";

const Page = async (props: SearchParamProps) => {
  const { id } = await props.params;
  const { userId } = await auth();

  if (!userId) redirect("/sign-in");

  const user = await getOrCreateUser(userId);
  const image = await getImageById(id);

  if (!image) notFound();

  const transformation =
    transformationTypes[image.transformationType as TransformationTypeKey];

  return (
    <>
      <Header title={transformation.title} subtitle={transformation.subTitle} />

      <section className="mt-10">
        <TransformationForm
          action="Update"
          userId={user._id}
          type={image.transformationType as TransformationTypeKey}
          creditBalance={user.creditBalance}
          config={image.config}
          data={image}
        />
      </section>
    </>
  );
};

export default Page;
