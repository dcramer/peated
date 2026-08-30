describe("external review publication", () => {
  test("starts unapproved", async ({ fixtures }) => {
    const publication = await fixtures.ExternalReviewPublication();

    expect(publication.approvedAt).toBeNull();
  });

  test("can be approved", async ({ fixtures }) => {
    const publication = await fixtures.ApprovedExternalReviewPublication();

    expect(publication.approvedAt).toBeInstanceOf(Date);
  });
});
