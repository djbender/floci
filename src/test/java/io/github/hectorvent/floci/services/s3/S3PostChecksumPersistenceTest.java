package io.github.hectorvent.floci.services.s3;

import com.fasterxml.jackson.core.type.TypeReference;
import io.github.hectorvent.floci.core.storage.InMemoryStorage;
import io.github.hectorvent.floci.core.storage.PersistentStorage;
import io.github.hectorvent.floci.services.s3.model.ChecksumType;
import io.github.hectorvent.floci.services.s3.model.PutObjectOptions;
import io.github.hectorvent.floci.services.s3.model.S3Checksum;
import io.github.hectorvent.floci.services.s3.model.S3Object;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * A checksum stored by a presigned POST goes through the same object store as every other upload,
 * so it survives a restart of a persistent store.
 */
class S3PostChecksumPersistenceTest {

    private static final byte[] BODY = "persisted post body".getBytes(StandardCharsets.UTF_8);

    @TempDir
    Path tempDir;

    private S3Service newService() {
        Path dataRoot = tempDir.resolve("s3");
        PersistentStorage<String, S3Object> objects = new PersistentStorage<>(
                tempDir.resolve("objects.json"), new TypeReference<Map<String, S3Object>>() { });
        objects.load();
        return new S3Service(new InMemoryStorage<>(), objects, dataRoot, false);
    }

    @Test
    void postedClientChecksumIsStoredAsFullObjectAndSurvivesReload() {
        S3Service first = newService();
        first.createBucket("bucket", "us-east-1");
        String sha256 = S3Checksum.sha256Base64(BODY);
        S3Checksum claimed = new S3Checksum();
        claimed.setChecksumSHA256(sha256);
        claimed.setChecksumType(ChecksumType.FULL_OBJECT);

        first.postObject("bucket", "post.txt", BODY, "text/plain", null,
                new PutObjectOptions().withClientChecksum(claimed));

        S3Service reloaded = newService();
        reloaded.createBucket("bucket", "us-east-1");
        S3Object head = reloaded.headObject("bucket", "post.txt");
        assertEquals(sha256, head.getChecksum().getChecksumSHA256());
        assertEquals(ChecksumType.FULL_OBJECT, head.getChecksum().getChecksumType());
    }
}
